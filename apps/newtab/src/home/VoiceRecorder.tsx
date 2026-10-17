import { useEffect, useRef, useState } from "react";

import { newId } from "../noghte/model";
import { barsPath, clock, resample, type Voice } from "../noghte/notes";
import { keepVoice } from "../noghte/voiceStore";
import { fa } from "../ui/fa";
import { Icon } from "../ui/Icon";

/**
 * The recording panel, as the app's (`apps/mobile/src/notes/VoiceRecorder.tsx`): in place of the
 * format bar it starts at once — a red dot that breathes and the time, the live wave moving as you
 * speak, and three controls: discard (asks once more with a second click), pause / resume, and the
 * white «تمام» that drops the recording into the note where the caret was. A recording left by
 * leaving the note is kept, not lost. The audio stays in this browser (`voiceStore`); the note
 * carries its wave and length, which is all that syncs.
 */

type Phase = "starting" | "recording" | "paused" | "denied";

/** A recording ends itself here. */
const MAX_MS = 30 * 60_000;
/** Shorter than this is a slip of the finger, not a recording. */
const MIN_MS = 700;
const TICK = 80;
/** Bars a recording keeps for its wave in the note. */
const KEPT_BARS = 120;
/** Bars of the live wave. */
const LIVE_BARS = 44;
/** How long «دور بریز؟» waits for the second click. */
const CONFIRM_MS = 3000;

type Run = {
  rec: MediaRecorder | null;
  stream: MediaStream | null;
  ctx: AudioContext | null;
  chunks: Blob[];
  levels: number[];
  t0: number;
  paused: number;
  pausedAt: number;
  phase: Phase;
  ended: boolean;
};

export function VoiceRecorder({
  onDone,
  onClose,
}: {
  /** The finished recording, its audio already kept in this browser. */
  onDone: (voice: Voice) => void;
  /** Nothing to keep (discarded, too short, no microphone), or after it was handed over. */
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [ms, setMs] = useState(0);
  const [live, setLive] = useState<number[]>([]);
  const [sure, setSure] = useState(false);
  const run = useRef<Run>({
    rec: null,
    stream: null,
    ctx: null,
    chunks: [],
    levels: [],
    t0: 0,
    paused: 0,
    pausedAt: 0,
    phase: "starting",
    ended: false,
  });
  // the latest callbacks, for a recording that ends after the panel is gone
  const done = useRef(onDone);
  const close = useRef(onClose);
  done.current = onDone;
  close.current = onClose;

  const go = (p: Phase): void => {
    run.current.phase = p;
    setPhase(p);
  };
  const elapsed = (): number => {
    const r = run.current;
    const now = r.phase === "paused" ? r.pausedAt : performance.now();
    return Math.max(0, now - r.t0 - r.paused);
  };

  /** Stops the recorder and the microphone; resolves with what was recorded. */
  const stop = (): Promise<Blob | null> => {
    const r = run.current;
    return new Promise((resolve) => {
      const finish = (): void => {
        r.stream?.getTracks().forEach((t) => {
          t.stop();
        });
        void r.ctx?.close().catch(() => undefined);
        r.stream = null;
        r.ctx = null;
        resolve(
          r.chunks.length === 0
            ? null
            : new Blob(r.chunks, { type: r.rec?.mimeType ?? "audio/webm" }),
        );
      };
      if (r.rec === null || r.rec.state === "inactive") finish();
      else {
        r.rec.onstop = finish;
        r.rec.stop();
      }
    });
  };

  const end = async (keep: boolean): Promise<void> => {
    const r = run.current;
    if (r.ended) return;
    r.ended = true;
    const took = elapsed();
    const blob = await stop();
    if (!keep || blob === null || took < MIN_MS) {
      close.current();
      return;
    }
    const peak = Math.max(0.0001, ...r.levels);
    const peaks = resample(r.levels, KEPT_BARS).map((v) => Math.round((v / peak) * 1000) / 1000);
    const file = `${newId()}.${blob.type.includes("mp4") ? "m4a" : "webm"}`;
    try {
      await keepVoice(file, blob);
    } catch {
      close.current();
      return;
    }
    done.current({ file, durationMs: Math.round(took), peaks });
    close.current();
  };

  useEffect(() => {
    const life = { dead: false };
    let timer: number | undefined;
    const r = run.current;
    void (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        if (!life.dead) go("denied");
        return;
      }
      if (life.dead) {
        stream.getTracks().forEach((t) => {
          t.stop();
        });
        return;
      }
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const rec = new MediaRecorder(stream, {
        ...(type === undefined ? {} : { mimeType: type }),
        audioBitsPerSecond: 64_000,
      });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) r.chunks.push(e.data);
      };
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      r.rec = rec;
      r.stream = stream;
      r.ctx = ctx;
      r.t0 = performance.now();
      rec.start(1000);
      go("recording");
      timer = window.setInterval(() => {
        if (r.phase !== "recording") return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        // speech sits low in the signal: lifted, so the wave moves
        const level = Math.min(1, Math.sqrt(sum / buf.length) * 4.2);
        r.levels.push(level);
        setLive(r.levels.slice(-LIVE_BARS));
        const t = elapsed();
        setMs(t);
        if (t >= MAX_MS) void end(true);
      }, TICK);
    })();
    return () => {
      life.dead = true;
      window.clearInterval(timer);
      // leaving the note keeps what was said
      if (r.rec !== null && !r.ended) void end(true);
    };
    // the panel runs once; `end` and `go` only touch refs and state setters
  }, []);

  useEffect(() => {
    if (!sure) return;
    const t = window.setTimeout(() => {
      setSure(false);
    }, CONFIRM_MS);
    return () => {
      window.clearTimeout(t);
    };
  }, [sure]);

  const pause = (): void => {
    const r = run.current;
    if (r.rec === null) return;
    if (r.phase === "recording") {
      r.rec.pause();
      r.pausedAt = performance.now();
      go("paused");
    } else if (r.phase === "paused") {
      r.rec.resume();
      r.paused += performance.now() - r.pausedAt;
      go("recording");
    }
  };

  if (phase === "denied") {
    return (
      <div className="rec denied" role="alert">
        <span>برای ضبط صدا، اجازه‌ی میکروفون را در مرورگر بده.</span>
        <button type="button" className="chip" onClick={onClose}>
          باشه
        </button>
      </div>
    );
  }

  return (
    <div className="rec">
      <span className={`dot ${phase}`} aria-hidden="true" />
      <span className="t">{fa(clock(ms))}</span>
      <svg
        className="live"
        viewBox={`0 0 ${String(LIVE_BARS * 6)} 32`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <path
          d={barsPath(
            [...new Array<number>(Math.max(0, LIVE_BARS - live.length)).fill(0), ...live],
            { step: 6, bar: 3, height: 32 },
          )}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <button
        type="button"
        className={sure ? "rbtn sm del sure" : "rbtn sm del"}
        aria-label={sure ? "دور بریز؟ دوباره بزن" : "دور بریز"}
        title={sure ? "دور بریز؟ دوباره بزن" : "دور بریز"}
        onClick={() => {
          if (sure) void end(false);
          else setSure(true);
        }}
      >
        <Icon name="delete" />
      </button>
      <button
        type="button"
        className="rbtn sm"
        aria-label={phase === "paused" ? "ادامه" : "مکث"}
        title={phase === "paused" ? "ادامه" : "مکث"}
        disabled={phase === "starting"}
        onClick={pause}
      >
        <Icon name={phase === "paused" ? "voice-play" : "voice-pause"} />
      </button>
      <button
        type="button"
        className="cta done"
        disabled={phase === "starting"}
        onClick={() => {
          void end(true);
        }}
      >
        تمام
      </button>
    </div>
  );
}
