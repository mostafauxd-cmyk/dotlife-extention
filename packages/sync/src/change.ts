import { z } from "zod";

/**
 * What travels between a phone and the server (PLAN §9, step 16.2). A change is the whole record
 * as it is now, not a diff: `data` is the record's JSON, or null once it is removed for good
 * (soft deletes, like a task's `deletedAt`, are ordinary data). `changedAt` is when the phone made
 * the change — not the record's own `updatedAt`, which some edits (pinning a note) leave alone.
 */

/**
 * Kinds of record that sync. The server stores their data as given; the app validates it.
 * `setting`: one of the app's settings, its stored text as is (`{ id: <key>, value }`).
 * `purchase`: one item put on the «خرید» list, once (2026-10-12) — never edited, so phones never
 * clash over it, and the server can count and report them.
 * `occasion`: one of the user's own occasions (a birthday); `occasion-reminder`: the reminders put
 * on one of the calendar's occasions, by its event id (2026-10-12).
 */
export const ENTITIES = [
  "list",
  "task",
  "note",
  "setting",
  "purchase",
  "occasion",
  "occasion-reminder",
] as const;
export type Entity = (typeof ENTITIES)[number];

export type Change = {
  entity: Entity;
  id: string;
  data: unknown;
  changedAt: string;
};

/** A change as the server holds it: `rev` orders every change of one account. */
export type ServerChange = Change & { rev: number };

/** One record's key, the same on every side. */
export const keyOf = (c: { entity: string; id: string }): string => `${c.entity}/${c.id}`;

// ---- wire format ----

/** A record's JSON may be at most this long (a long note with many blocks stays far below). */
export const MAX_RECORD_BYTES = 256 * 1024;
/** Changes per push; a phone with more sends them in several pushes. */
export const MAX_PUSH = 500;
/** A push's JSON stays under this (the server refuses bodies over 4MB): send in several pushes. */
export const MAX_PUSH_BYTES = 2 * 1024 * 1024;
/** Changes per pull page. */
export const PULL_PAGE = 500;

const Iso = z.iso.datetime({ offset: true });

export const ChangeSchema = z
  .object({
    entity: z.enum(ENTITIES),
    id: z.string().min(1).max(64),
    data: z.unknown(),
    changedAt: Iso,
  })
  .refine((c) => c.data === null || (typeof c.data === "object" && !Array.isArray(c.data)), {
    message: "data must be an object or null",
  })
  .refine((c) => c.data === null || JSON.stringify(c.data).length <= MAX_RECORD_BYTES, {
    message: "record too large",
  });

export const ServerChangeSchema = z.object({
  entity: z.enum(ENTITIES),
  id: z.string(),
  data: z.unknown(),
  changedAt: Iso,
  rev: z.number().int().nonnegative(),
});

export const PushRequestSchema = z.object({
  changes: z.array(ChangeSchema).max(MAX_PUSH),
});
export type PushRequest = z.infer<typeof PushRequestSchema>;

export const PushResponseSchema = z.object({
  /** The account's latest rev after this push. */
  rev: z.number().int().nonnegative(),
  /** Changes the server already had newer versions of: the phone takes these instead. */
  rejected: z.array(ServerChangeSchema),
});
export type PushResponse = z.infer<typeof PushResponseSchema>;

export const PullResponseSchema = z.object({
  /** Records changed after the cursor, oldest first, one (the latest) per record. */
  changes: z.array(ServerChangeSchema),
  /** Pull again from here; equal to the cursor when nothing changed. */
  rev: z.number().int().nonnegative(),
  /** More changes wait past this page. */
  more: z.boolean(),
  /**
   * The cursor was ahead of the server (its data restored from an older backup): this page starts
   * over from the beginning, and the phone should push everything it has again.
   */
  reset: z.boolean().optional(),
});
export type PullResponse = z.infer<typeof PullResponseSchema>;
