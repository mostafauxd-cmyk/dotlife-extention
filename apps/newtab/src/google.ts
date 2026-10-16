import { useEffect, useState } from "react";

import { inExtension, load, remove, save } from "./platform";

/**
 * Google Calendar and Google Meet for the new tab. The person connects their Google account once
 * (Chrome's own sign-in window, `chrome.identity.launchWebAuthFlow`), with the web client of the
 * Google Cloud project «Nasim Sahar» — the same project the phone app signs in with. The window's
 * answer comes back to `https://<extension id>.chromiumapp.org/`, which must be listed among that
 * client's redirect addresses; the extension's id is fixed by the `key` in its manifest.
 *
 * Asked for: the list of calendars, their events (read and write), and making Meet meetings —
 * nothing else of the account. Tokens last an hour and are renewed silently while Google allows.
 */

const FROM_ENV = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
// not a secret: the app ships the same id inside every build
const CLIENT_ID =
  FROM_ENV !== undefined && FROM_ENV !== ""
    ? FROM_ENV
    : "466907834365-79lh6slme8m9dmte9e888reooo72ktqj.apps.googleusercontent.com";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/meetings.space.created",
];

const KEY = "google.v1";
type Stored = { token: string; expiresAt: number; email: string | null };

export type GoogleState =
  | { status: "unavailable" }
  | { status: "off" }
  | { status: "on"; email: string | null }
  | { status: "expired"; email: string | null };

let stored: Stored | null = null;
let state: GoogleState = inExtension ? { status: "off" } : { status: "unavailable" };
const listeners = new Set<() => void>();
const setState = (s: GoogleState): void => {
  state = s;
  for (const l of listeners) l();
};

/** Reads what was kept from the last connection (on opening the tab). */
export async function loadGoogle(): Promise<void> {
  if (!inExtension) return;
  stored = (await load<Stored>(KEY)) ?? null;
  if (stored === null) setState({ status: "off" });
  else
    setState(
      stored.expiresAt > Date.now()
        ? { status: "on", email: stored.email }
        : { status: "expired", email: stored.email },
    );
}

export function useGoogle(): GoogleState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = (): void => {
      setTick((t) => t + 1);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

/** Chrome's sign-in window (interactive), or a silent renewal (not). Null when it did not happen. */
async function authorize(interactive: boolean): Promise<Stored | null> {
  if (!inExtension) return null;
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", CLIENT_ID);
  u.searchParams.set("response_type", "token");
  u.searchParams.set("redirect_uri", chrome.identity.getRedirectURL());
  u.searchParams.set("scope", ["openid", "email", ...SCOPES].join(" "));
  u.searchParams.set("include_granted_scopes", "true");
  if (!interactive) u.searchParams.set("prompt", "none");
  if (stored?.email) u.searchParams.set("login_hint", stored.email);
  let answer: string | undefined;
  try {
    answer = await chrome.identity.launchWebAuthFlow({ url: u.toString(), interactive });
  } catch {
    return null;
  }
  if (answer === undefined) return null;
  const p = new URLSearchParams(new URL(answer).hash.slice(1));
  const token = p.get("access_token");
  if (token === null) return null;
  const expiresAt = Date.now() + (Number(p.get("expires_in") ?? "3600") - 60) * 1000;
  let email = stored?.email ?? null;
  try {
    const me = (await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json())) as { email?: string };
    email = me.email ?? email;
  } catch {
    // the email is only for showing which account is connected
  }
  const s: Stored = { token, expiresAt, email };
  stored = s;
  await save(KEY, s);
  setState({ status: "on", email });
  return s;
}

/** Connects the account (the button in «تقویم‌ها» or in the task form). */
export async function connectGoogle(): Promise<boolean> {
  return (await authorize(true)) !== null;
}

/** Forgets the account here and gives the token back to Google. */
export async function disconnectGoogle(): Promise<void> {
  const t = stored?.token;
  stored = null;
  await remove(KEY);
  setState({ status: "off" });
  if (t !== undefined)
    void fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t)}`, {
      method: "POST",
    }).catch(() => undefined);
}

async function token(): Promise<string | null> {
  if (stored !== null && stored.expiresAt > Date.now()) return stored.token;
  if (stored === null) return null;
  const renewed = await authorize(false);
  if (renewed === null) {
    setState({ status: "expired", email: stored.email });
    return null;
  }
  return renewed.token;
}

export class GoogleError extends Error {}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const t = await token();
    if (t === null) throw new GoogleError("not connected");
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    });
    if (res.status === 401 && attempt === 0 && stored !== null) {
      stored = { ...stored, expiresAt: 0 };
      continue;
    }
    if (res.status === 204) return undefined as T;
    if (!res.ok) throw new GoogleError(`${String(res.status)}: ${await res.text()}`);
    return (await res.json()) as T;
  }
  throw new GoogleError("unauthorized");
}

// ---- calendars and events ----

export type GCalendar = {
  id: string;
  name: string;
  color: string;
  writable: boolean;
  primary: boolean;
};

export async function listCalendars(): Promise<GCalendar[]> {
  type Item = {
    id: string;
    summary: string;
    summaryOverride?: string;
    backgroundColor?: string;
    accessRole: string;
    primary?: boolean;
    selected?: boolean;
  };
  const r = await api<{ items?: Item[] }>(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
  );
  return (r.items ?? [])
    .filter((c) => c.selected !== false || c.primary === true)
    .map((c) => ({
      id: c.id,
      name: c.summaryOverride ?? (c.primary === true ? "شخصی" : c.summary),
      color: c.backgroundColor ?? "#5AB0FF",
      writable: c.accessRole === "owner" || c.accessRole === "writer",
      primary: c.primary === true,
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary));
}

/** One event as the planner needs it: start and end as instants, or whole days. */
export type GEvent = {
  key: string;
  calendarId: string;
  id: string;
  title: string;
  description: string;
  location: string;
  /** ISO instants for a timed event; "YYYY-MM-DD" for a whole-day one (end exclusive). */
  start: string;
  end: string;
  allDay: boolean;
  meet: string;
  recurring: boolean;
  htmlLink: string;
};

type RawEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  recurringEventId?: string;
  htmlLink?: string;
};

const toEvent = (calendarId: string, e: RawEvent): GEvent | null => {
  if (e.status === "cancelled" || e.start === undefined || e.end === undefined) return null;
  const allDay = e.start.date !== undefined;
  const description = e.description ?? "";
  return {
    key: `${calendarId}/${e.id}`,
    calendarId,
    id: e.id,
    title: e.summary ?? "(بدون عنوان)",
    description,
    location: e.location ?? "",
    start: (allDay ? e.start.date : e.start.dateTime) ?? "",
    end: (allDay ? e.end.date : e.end.dateTime) ?? "",
    allDay,
    meet: e.hangoutLink ?? meetIn(description),
    recurring: e.recurringEventId !== undefined,
    htmlLink: e.htmlLink ?? "",
  };
};

export async function listEvents(calendarId: string, from: Date, to: Date): Promise<GEvent[]> {
  const u = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  u.searchParams.set("timeMin", from.toISOString());
  u.searchParams.set("timeMax", to.toISOString());
  u.searchParams.set("singleEvents", "true");
  u.searchParams.set("orderBy", "startTime");
  u.searchParams.set("maxResults", "250");
  const r = await api<{ items?: RawEvent[] }>(u.toString());
  return (r.items ?? []).flatMap((e) => toEvent(calendarId, e) ?? []);
}

export type EventFields = {
  title: string;
  description: string;
  /** ISO instants, or "YYYY-MM-DD" for whole days (end exclusive). */
  start: string;
  end: string;
  allDay: boolean;
  timeZone: string;
};

const body = (f: EventFields) => ({
  summary: f.title,
  description: f.description,
  start: f.allDay ? { date: f.start } : { dateTime: f.start, timeZone: f.timeZone },
  end: f.allDay ? { date: f.end } : { dateTime: f.end, timeZone: f.timeZone },
});

/** A new event; with `meet`, Google makes its Meet meeting itself (conferenceData). */
export async function insertEvent(
  calendarId: string,
  f: EventFields,
  meet: boolean,
): Promise<GEvent | null> {
  const u = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`;
  const e = await api<RawEvent>(u, {
    method: "POST",
    body: JSON.stringify({
      ...body(f),
      ...(meet
        ? {
            conferenceData: {
              createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }
        : {}),
    }),
  });
  return toEvent(calendarId, e);
}

export async function patchEvent(
  ev: GEvent,
  f: Partial<EventFields>,
  meet: boolean | null,
): Promise<void> {
  const full = {
    title: ev.title,
    description: ev.description,
    start: ev.start,
    end: ev.end,
    allDay: ev.allDay,
    timeZone: "Asia/Tehran",
    ...f,
  };
  const u = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(ev.calendarId)}/events/${encodeURIComponent(ev.id)}?conferenceDataVersion=1`;
  await api(u, {
    method: "PATCH",
    body: JSON.stringify({
      ...body(full),
      ...(meet === true && ev.meet === ""
        ? {
            conferenceData: {
              createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }
        : {}),
    }),
  });
}

export async function deleteEvent(ev: GEvent): Promise<void> {
  await api(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(ev.calendarId)}/events/${encodeURIComponent(ev.id)}`,
    { method: "DELETE" },
  );
}

/** A Meet meeting for a نقطه task (Meet REST `spaces.create`), as the app's Meet button does. */
export async function createMeetLink(): Promise<string> {
  const space = await api<{ meetingUri?: string }>("https://meet.googleapis.com/v2/spaces", {
    method: "POST",
    body: "{}",
  });
  if (space.meetingUri === undefined) throw new GoogleError("no meetingUri");
  return space.meetingUri;
}

// ---- a Meet link in a task's notes, written as the app writes it (apps/mobile calendarSources/agenda.ts) ----

const RULER = "-::~:~::~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~::~:~::-";
const MEET_RE = /https?:\/\/meet\.google\.com\/[^\s<>"')\]]+/;

export const meetBlock = (url: string): string =>
  [RULER, `Join with Google Meet: ${url}`, RULER].join("\n");

/** The Google Meet link notes carry, or "". */
export const meetIn = (notes: string): string => MEET_RE.exec(notes)?.[0] ?? "";

/** The person's own text, without the Meet block (what the form shows in «یادداشت»). */
export function withoutMeet(notes: string): string {
  const lines = notes.split(/\r?\n/);
  const rulers = lines.flatMap((l, i) => (l.trim() === RULER ? [i] : []));
  const first = rulers[0];
  const last = rulers.at(-1);
  return lines
    .filter(
      (_l, i) =>
        !(first !== undefined && last !== undefined && first !== last && i >= first && i <= last),
    )
    .filter((l) => !MEET_RE.test(l))
    .join("\n")
    .trim();
}

/** The person's text with a Meet block under it (or just the text when there is no link). */
export const withMeet = (text: string, url: string): string =>
  [text.trim(), url === "" ? "" : meetBlock(url)].filter((s) => s !== "").join("\n\n");

// ---- what the plans slide shows: the calendars and the events of the days in view ----

/** Something changed in Google (a save from the form): everything shown is asked for again. */
let version = 0;
export function googleChanged(): void {
  version++;
  for (const l of listeners) l();
}

let calendarsCache: { version: number; list: GCalendar[] } | null = null;

export function useGoogleCalendars(): GCalendar[] {
  const g = useGoogle();
  const [list, setList] = useState<GCalendar[]>(calendarsCache?.list ?? []);
  const v = version;
  useEffect(() => {
    if (g.status !== "on") {
      setList([]);
      return;
    }
    if (calendarsCache?.version === v) {
      setList(calendarsCache.list);
      return;
    }
    let live = true;
    void listCalendars()
      .then((l) => {
        calendarsCache = { version: v, list: l };
        if (live) setList(l);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [g.status, v]);
  return list;
}

/** The events of the shown calendars between two days (Tehran's clock), asked again every 2 minutes. */
export function useGoogleEvents(
  from: string,
  to: string,
  calendarIds: readonly string[],
): GEvent[] {
  const g = useGoogle();
  const [events, setEvents] = useState<GEvent[]>([]);
  const [tick, setTick] = useState(0);
  const ids = calendarIds.join("|");
  const v = version;
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setTick((x) => x + 1);
    }, 120_000);
    return () => {
      clearInterval(t);
    };
  }, []);
  useEffect(() => {
    if (g.status !== "on" || ids === "") {
      setEvents([]);
      return;
    }
    let live = true;
    const start = new Date(`${from}T00:00:00+03:30`);
    const end = new Date(new Date(`${to}T00:00:00+03:30`).getTime() + 86_400_000);
    void Promise.all(ids.split("|").map((id) => listEvents(id, start, end).catch(() => []))).then(
      (all) => {
        if (live) setEvents(all.flat());
      },
    );
    return () => {
      live = false;
    };
  }, [g.status, from, to, ids, v, tick]);
  return events;
}
