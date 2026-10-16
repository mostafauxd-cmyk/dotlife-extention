import { useEffect, useRef, useState } from "react";

import { Corner, NotesCard, TasksCard, TodayCard, type Peek } from "./home/Corners";
import { Customize } from "./home/Customize";
import { DateLine } from "./home/DateLine";
import { Dot } from "./home/Dot";
import { Edge } from "./home/Edge";
import { Launcher } from "./home/Launcher";
import { NotesSlide } from "./home/NotesSlide";
import { PlansSlide } from "./home/PlansSlide";
import { Rail, type SlideInfo } from "./home/Rail";
import { SearchBox } from "./home/SearchBox";
import { SignIn } from "./home/SignIn";
import { SocialSlide } from "./home/SocialSlide";
import { TaskEditorHost } from "./home/TaskEditor";
import { useSession, useSettings } from "./hooks";
import { onArrival } from "./noghte/sync";
import { isOn, orderedSlides, SLIDES, themeOf, updateSettings, type SlideId } from "./settings";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/icons";

type Corners = "tasks" | "notes";

/** How long a corner that opened by itself stays open (unless the mouse is on it). */
const PEEK_MS = 5000;

export function App() {
  const s = useSettings();
  const session = useSession();
  const theme = themeOf(s);
  const [entering] = useState(
    () => isOn(s, "entry") && !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hinting, setHinting] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [signIn, setSignIn] = useState<"hello" | "phone" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [peeks, setPeeks] = useState<Record<Corners, Peek>>({ tasks: null, notes: null });
  const [dots, setDots] = useState<Record<Corners, boolean>>({ tasks: false, notes: false });
  const timers = useRef<Partial<Record<Corners, ReturnType<typeof setTimeout>>>>({});

  useEffect(() => {
    document.body.style.background = theme.bg;
  }, [theme.bg]);

  // the corners' names show for a moment after the entry, so a first-timer knows they are there
  useEffect(() => {
    const a = setTimeout(() => {
      setHinting(true);
    }, 1000);
    const b = setTimeout(() => {
      setHinting(false);
    }, 6000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const peek = (c: Corners, label: string, keys: ReadonlySet<string>): void => {
    if (!isOn(s, "peek") || document.visibilityState !== "visible") {
      setDots((d) => ({ ...d, [c]: true }));
      return;
    }
    setPeeks((p) => ({ ...p, [c]: { label, keys } }));
    clearTimeout(timers.current[c]);
    timers.current[c] = setTimeout(() => {
      setPeeks((p) => ({ ...p, [c]: null }));
    }, PEEK_MS);
  };

  // something written on the phone: its corner opens like a notification
  useEffect(
    () =>
      onArrival((changes) => {
        const tasks = changes
          .filter((c) => c.entity === "task" && c.data !== null)
          .map((c) => c.id);
        const notes = changes
          .filter((c) => c.entity === "note" && c.data !== null)
          .map((c) => c.id);
        if (tasks.length > 0) peek("tasks", "از گوشی · همین حالا", new Set(tasks));
        if (notes.length > 0) peek("notes", "از گوشی · همین حالا", new Set(notes));
      }),
    [s],
  );

  const saved = (kind: "task" | "note"): void => {
    setToast("ذخیره شد · روی گوشی هم هست");
    setTimeout(() => {
      setToast(null);
    }, 2200);
    peek(kind === "task" ? "tasks" : "notes", "از سرچ · همین حالا", new Set());
  };

  const signedIn = session !== null;
  const pinned = isOn(s, "pin");
  const openSignIn = (): void => {
    setSignIn("phone");
  };

  // the first new tab after installing: what an account gives, once the page has drawn itself
  useEffect(() => {
    if (signedIn || s.welcomed) return;
    const t = setTimeout(() => {
      updateSettings({ welcomed: true });
      setSignIn("hello");
    }, 900);
    return () => {
      clearTimeout(t);
    };
  }, []); // only on opening the tab
  const cls = ["nt", entering ? "enter" : "", hinting ? "hinting" : ""].filter(Boolean).join(" ");
  const scroller = useRef<HTMLDivElement>(null);
  // the slides in the person's order; each one that is switched on and built gets a screen
  const SLIDE_UI: Partial<Record<SlideId, { icon: IconName; node: React.ReactNode }>> = {
    "s-plans": { icon: "calendar-face", node: <PlansSlide /> },
    "s-social": { icon: "chat", node: <SocialSlide /> },
    "s-notes": {
      icon: "sticker-note",
      node: <NotesSlide signedIn={signedIn} onSignIn={openSignIn} />,
    },
  };
  const shownSlides = orderedSlides(s).filter((id) => isOn(s, id) && SLIDE_UI[id] !== undefined);
  const slides: SlideInfo[] = [
    { id: "s-home", icon: "home", name: "خانه" },
    ...shownSlides.map((id) => ({
      id,
      icon: SLIDE_UI[id]?.icon ?? "home",
      name: SLIDES.find(([x]) => x === id)?.[1] ?? "",
    })),
  ];
  const empty = new Set<string>();

  return (
    <div className={cls} style={{ "--bgc": theme.bg, "--tint": theme.tint } as React.CSSProperties}>
      <div className="wall" />

      {/* the slides, one screen each, snapping into place as you scroll; the home is always first */}
      <div className="slides" ref={scroller}>
        <section className="slide" id="s-home" aria-label="خانه">
          <main className="hero">
            <Dot drawAfter={entering ? 0 : null} />
            <SearchBox traceAfter={entering ? 350 : null} onSaved={saved} />
            {isOn(s, "launcher") && <Launcher />}
            {isOn(s, "dateline") && <DateLine />}
          </main>

          {isOn(s, "tasks") && (
            <Corner
              pos="tr"
              icon="tick-square"
              label="کارها"
              pinned={pinned}
              peek={peeks.tasks}
              dot={dots.tasks}
            >
              <TasksCard
                signedIn={signedIn}
                fresh={peeks.tasks?.keys ?? empty}
                onSignIn={openSignIn}
              />
            </Corner>
          )}
          {isOn(s, "notes") && (
            <Corner
              pos="tl"
              icon="sticker-note"
              label="یادداشت‌ها"
              pinned={pinned}
              peek={peeks.notes}
              dot={dots.notes}
            >
              <NotesCard
                signedIn={signedIn}
                fresh={peeks.notes?.keys ?? empty}
                onSignIn={openSignIn}
              />
            </Corner>
          )}
          {isOn(s, "today") && (
            <Corner
              pos="bl"
              icon="calendar-face"
              label="امروز"
              pinned={pinned}
              peek={null}
              dot={false}
            >
              <TodayCard />
            </Corner>
          )}

          <Edge
            showBookmarks={isOn(s, "bookmarks")}
            pinned={false}
            onCustomize={() => {
              setCustOpen(true);
            }}
          />

          {/* always in sight: the one way into «شخصی‌سازی» that needs no hunting */}
          <button
            type="button"
            className="gear"
            aria-label="شخصی‌سازی"
            title="شخصی‌سازی"
            onClick={() => {
              setCustOpen(true);
            }}
          >
            <Icon name="setting" />
          </button>
        </section>

        {shownSlides.map((id) => (
          <section
            key={id}
            className="slide"
            id={id}
            aria-label={SLIDES.find(([x]) => x === id)?.[1]}
          >
            {SLIDE_UI[id]?.node}
          </section>
        ))}
      </div>
      <Rail slides={slides} scroller={scroller} />

      {custOpen && (
        <Customize
          onClose={() => {
            setCustOpen(false);
          }}
          onSignIn={openSignIn}
        />
      )}
      {signIn !== null && (
        <SignIn
          start={signIn}
          onClose={(created) => {
            setSignIn(null);
            if (created) {
              setToast("حساب نقطه‌ات ساخته شد");
              setTimeout(() => {
                setToast(null);
              }, 3200);
            }
          }}
        />
      )}
      <TaskEditorHost />
      {toast !== null && <div className="toast">{toast}</div>}
    </div>
  );
}
