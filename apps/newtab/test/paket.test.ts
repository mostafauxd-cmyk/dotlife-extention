import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Call = { path: string; method: string; auth: string | null; body: unknown };

let calls: Call[];
let answers: ((path: string) => { status: number; body: unknown } | "offline")[];

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
    clear: () => {
      m.clear();
    },
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

const tokens = (n: number, expiresInSeconds = 900) => ({
  tokens: {
    accessToken: `at${String(n)}`,
    refreshToken: `rt_${String(n)}`,
    expiresInSeconds,
    tokenType: "Bearer",
  },
});

beforeEach(() => {
  calls = [];
  answers = [];
  vi.resetModules();
  vi.stubGlobal("localStorage", fakeStorage());
  vi.stubGlobal("document", { visibilityState: "visible" });
  vi.stubGlobal("fetch", (url: string, init: RequestInit = {}) => {
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({
      path,
      method: init.method ?? "GET",
      auth: headers.Authorization ?? null,
      body: typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : null,
    });
    const next = answers.shift();
    if (next === undefined) return Promise.reject(new Error("no answer queued"));
    const a = next(path);
    if (a === "offline") return Promise.reject(new TypeError("Failed to fetch"));
    return Promise.resolve({ status: a.status, json: () => Promise.resolve(a.body) });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const load = () => import("../src/paket");

const SNAP = {
  generatedAt: "2026-10-17T09:00:00Z",
  balance: { amountMinor: "100", currencyCode: "IRT" },
};

describe("formatCode", () => {
  it("makes capitals with a dash after four, and drops what the code never has", async () => {
    const { formatCode } = await load();
    expect(formatCode("k7qm")).toBe("K7QM");
    expect(formatCode("k7qm4")).toBe("K7QM-4");
    expect(formatCode("k7qm-4xda")).toBe("K7QM-4XDA");
    // 0 O 1 I L 2 Z 5 S 8 B are not in the alphabet; more than eight letters are cut
    expect(formatCode("0O1I-L2Z5-S8B-K7QM-4XDA-AAAA")).toBe("K7QM-4XDA");
  });

  it("takes the code out of a whole pairing link", async () => {
    const { formatCode } = await load();
    expect(formatCode("paket://pair?c=K7QM4XDA")).toBe("K7QM-4XDA");
  });
});

describe("linking, reading and refreshing", () => {
  it("links with the code and reads the snapshot with the access token", async () => {
    const { linkPaket, snapshot } = await load();
    answers.push(
      () => ({ status: 200, body: tokens(1) }),
      () => ({ status: 200, body: SNAP }),
    );
    await linkPaket("K7QM-4XDA");
    expect(calls[0]?.path).toBe("/v1/extension/pair/redeem");
    expect((calls[0]?.body as { code: string; installationId: string }).code).toBe("K7QM-4XDA");
    expect((calls[0]?.body as { installationId: string }).installationId).toMatch(/^noghte-/);
    const s = await snapshot();
    expect(calls[1]?.auth).toBe("Bearer at1");
    // what the server leaves out is filled in
    expect(s.accounts).toEqual([]);
    expect(s.obligations.items).toEqual([]);
    expect(s.pendingApprovals.count).toBe(0);
  });

  it("refreshes an expired access token and keeps the new refresh token", async () => {
    const { linkPaket, snapshot } = await load();
    answers.push(
      () => ({ status: 200, body: tokens(1, 0) }), // already expired
      () => ({ status: 200, body: tokens(2) }),
      () => ({ status: 200, body: SNAP }),
    );
    await linkPaket("K7QM-4XDA");
    await snapshot();
    expect(calls[1]?.path).toBe("/v1/auth/refresh");
    expect((calls[1]?.body as { refreshToken: string }).refreshToken).toBe("rt_1");
    expect(calls[2]?.auth).toBe("Bearer at2");
    // the next refresh uses the rotated token
    answers.push(
      () => ({ status: 200, body: tokens(3, 0) }),
      () => ({ status: 200, body: SNAP }),
    );
    await snapshot();
  });

  it("asks once more after a 401 on the snapshot, by refreshing", async () => {
    const { linkPaket, snapshot } = await load();
    answers.push(
      () => ({ status: 200, body: tokens(1) }),
      () => ({ status: 401, body: { code: "INVALID_TOKEN" } }),
      () => ({ status: 200, body: tokens(2) }),
      () => ({ status: 200, body: SNAP }),
    );
    await linkPaket("K7QM-4XDA");
    await snapshot();
    expect(calls.map((c) => c.path)).toEqual([
      "/v1/extension/pair/redeem",
      "/v1/extension/snapshot",
      "/v1/auth/refresh",
      "/v1/extension/snapshot",
    ]);
  });

  it("forgets the link when Paket refuses the refresh token", async () => {
    const { linkPaket, snapshot } = await load();
    answers.push(
      () => ({ status: 200, body: tokens(1, 0) }),
      () => ({ status: 401, body: { code: "INVALID_REFRESH_TOKEN" } }),
      () => ({ status: 200, body: {} }), // the logout that follows
    );
    await linkPaket("K7QM-4XDA");
    await expect(snapshot()).rejects.toMatchObject({ code: "not_linked" });
    await expect(snapshot()).rejects.toMatchObject({ code: "not_linked" });
    expect(localStorage.getItem("paket.v1")).toBeNull();
  });

  it("forgets the link when the device was revoked on the phone", async () => {
    const { linkPaket, snapshot } = await load();
    answers.push(
      () => ({ status: 200, body: tokens(1) }),
      () => ({ status: 401, body: { code: "DEVICE_REVOKED" } }),
      () => ({ status: 200, body: {} }),
    );
    await linkPaket("K7QM-4XDA");
    await expect(snapshot()).rejects.toMatchObject({ code: "not_linked" });
    expect(localStorage.getItem("paket.v1")).toBeNull();
  });

  it("says offline when Paket cannot be reached, and keeps the link", async () => {
    const { linkPaket, snapshot } = await load();
    answers.push(
      () => ({ status: 200, body: tokens(1) }),
      () => "offline",
    );
    await linkPaket("K7QM-4XDA");
    await expect(snapshot()).rejects.toMatchObject({ code: "offline" });
    expect(localStorage.getItem("paket.v1")).not.toBeNull();
  });

  it("names a wrong code by Paket's own code", async () => {
    const { linkPaket } = await load();
    answers.push(() => ({ status: 400, body: { code: "INVALID_PAIRING_CODE" } }));
    await expect(linkPaket("AAAA-AAAA")).rejects.toMatchObject({ code: "INVALID_PAIRING_CODE" });
  });
});

describe("unlinkPaket", () => {
  it("signs this device out at Paket first, then forgets it here, even if Paket is down", async () => {
    const { linkPaket, unlinkPaket } = await load();
    answers.push(
      () => ({ status: 200, body: tokens(1) }),
      () => "offline",
    );
    await linkPaket("K7QM-4XDA");
    await unlinkPaket();
    expect(calls[1]).toMatchObject({ path: "/v1/auth/logout", method: "POST", auth: "Bearer at1" });
    expect(localStorage.getItem("paket.v1")).toBeNull();
    expect(localStorage.getItem("paket.snapshot.v1")).toBeNull();
  });
});
