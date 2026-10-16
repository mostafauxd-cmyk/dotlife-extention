import { keyOf, settlePush, type Change, type Entity, type Local as Held } from "@dotlife/sync";

import { load, save } from "../platform";
import type { Local } from "../sync/engine";

/**
 * This browser's copy of the account's records — lists, tasks, notes — as the server sends them,
 * plus the outbox: records changed here and not yet pushed. One object in the extension's storage,
 * written a moment after each change. Records of another account are dropped on sign-in.
 */

const KEY = "noghte.records.v1";

type Stored = { account: string; cursor: number; items: Held[] };

export class Records {
  private map = new Map<string, Held>();
  private rev = 0;
  private account = "";
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<(entities: ReadonlySet<string>) => void>();
  /** Records the server sent that are new to this browser — not its own changes coming back. */
  private arrived: Change[] = [];

  /** Reads the stored copy; a copy of another account (or none) starts empty. */
  async open(account: string): Promise<void> {
    const s = await load<Stored>(KEY);
    this.account = account;
    if (s?.account === account) {
      this.map = new Map(s.items.map((h) => [keyOf(h.change), h]));
      this.rev = s.cursor;
    } else {
      this.map = new Map();
      this.rev = 0;
    }
    this.emit(new Set(["list", "task", "note"]));
  }

  /** Forgets everything (signed out). */
  async clear(): Promise<void> {
    this.map = new Map();
    this.rev = 0;
    this.account = "";
    await save(KEY, { account: "", cursor: 0, items: [] } satisfies Stored);
    this.emit(new Set(["list", "task", "note"]));
  }

  onChange(fn: (entities: ReadonlySet<string>) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Every live record of a kind (removed ones, `data: null`, left out). */
  all<T>(entity: Entity): T[] {
    const out: T[] = [];
    for (const h of this.map.values()) {
      if (h.change.entity === entity && h.change.data !== null) out.push(h.change.data as T);
    }
    return out;
  }

  /** A change made here: kept, and into the outbox until the server has it. */
  write(entity: Entity, id: string, data: unknown): void {
    const change: Change = { entity, id, data, changedAt: new Date().toISOString() };
    this.map.set(keyOf(change), { change, dirty: true });
    this.changed(new Set([entity]));
  }

  /** What arrived since the last call (for the corner that opens by itself). */
  takeArrived(): Change[] {
    const a = this.arrived;
    this.arrived = [];
    return a;
  }

  pending(): number {
    let n = 0;
    for (const h of this.map.values()) if (h.dirty) n++;
    return n;
  }

  /** The engine's view of these records (`Local` in sync/engine.ts). */
  readonly local: Local = {
    dirty: (limit) =>
      Promise.resolve(
        [...this.map.values()]
          .filter((h) => h.dirty)
          .map((h) => h.change)
          .sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt))
          .slice(0, limit),
      ),
    get: (entity, id) => Promise.resolve(this.map.get(keyOf({ entity, id }))),
    adopt: (changes, settled) => {
      for (const c of changes) {
        const had = this.map.get(keyOf(c));
        // this browser's own change, back from the server: nothing new
        if (had?.change.changedAt !== c.changedAt) this.arrived.push(c);
        this.map.set(keyOf(c), { change: c, dirty: false });
      }
      for (const k of settled) {
        const h = this.map.get(k);
        if (h !== undefined) h.dirty = false;
      }
      if (changes.length > 0 || settled.length > 0) {
        this.changed(new Set(changes.map((c) => c.entity)));
      }
      return Promise.resolve();
    },
    settle: (sent) => {
      for (const k of settlePush(sent, (key) => this.map.get(key)?.change)) {
        const h = this.map.get(k);
        if (h !== undefined) h.dirty = false;
      }
      this.persistSoon();
      return Promise.resolve();
    },
    markAllDirty: () => {
      for (const h of this.map.values()) h.dirty = true;
      this.persistSoon();
      return Promise.resolve();
    },
    cursor: () => Promise.resolve(this.rev),
    setCursor: (rev) => {
      this.rev = rev;
      this.persistSoon();
      return Promise.resolve();
    },
  };

  private changed(entities: ReadonlySet<string>): void {
    this.persistSoon();
    this.emit(entities);
  }

  private emit(entities: ReadonlySet<string>): void {
    for (const l of this.listeners) l(entities);
  }

  private persistSoon(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.persist();
    }, 300);
  }

  async persist(): Promise<void> {
    if (this.account === "") return;
    await save(KEY, {
      account: this.account,
      cursor: this.rev,
      items: [...this.map.values()],
    } satisfies Stored);
  }
}

export const records = new Records();
