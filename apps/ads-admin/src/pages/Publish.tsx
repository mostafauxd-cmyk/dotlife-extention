import type { Bundle } from "@dotlife/ads";
import { useEffect, useRef, useState } from "react";

import { useApp, useAds, useCampaigns, useLastBundle } from "../context";
import { jalali, num } from "../data/labels";
import {
  buildBundle,
  campaignMap,
  canonicalJson,
  overfilled,
  parseImport,
  planImport,
  SIGNATURE_PLACEHOLDER,
  sha256Hex,
  slideFilled,
  slides,
  type ImportResult,
} from "../data/logic";
import { Icon } from "../ui/Icon";

/** The bundle as clients receive it; the signature is the server's, so it shows as a placeholder here. */
const shown = (b: Bundle): string =>
  JSON.stringify({ ...b, signature: SIGNATURE_PLACEHOLDER }, null, 2);

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const timeOf = (iso: string): string =>
  new Date(iso).toLocaleString("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short" });

function Importer() {
  const { ads: store, toast } = useApp();
  const { ads } = useAds();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const file = useRef<HTMLInputElement>(null);
  const parsed: ImportResult | undefined = text.trim() === "" ? undefined : parseImport(text);
  const plan = parsed?.ok === true ? planImport(ads, parsed.ads, mode) : undefined;

  const apply = (): void => {
    if (plan === undefined || parsed?.ok !== true) return;
    const job = (
      mode === "replace" ? store.replaceAll(plan.result) : store.putMany(plan.result)
    ).then(async () => {
      for (const c of parsed.campaigns) await store.putCampaign(c);
    });
    job.then(
      () => {
        toast(`${num(parsed.ads.length)} تبلیغ درون‌ریزی شد.`);
        setText("");
      },
      () => {
        toast("درون‌ریزی نشد.");
      },
    );
  };

  return (
    <section className="card">
      <h2>درون‌ریزی</h2>
      <p className="note">
        فایل JSON یک بسته (<code>{"{ version, generatedAt, ads }"}</code>) یا فهرستی از تبلیغ‌ها. هر
        تبلیغ با همان قالب مشترک بررسی می‌شود؛ تا درست نباشد چیزی نوشته نمی‌شود.
      </p>
      <div className="import-row">
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f === undefined) return;
            void f.text().then(setText);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            file.current?.click();
          }}
        >
          <Icon name="upload" size={16} />
          انتخاب فایل
        </button>
      </div>
      <textarea
        className="json-in"
        dir="ltr"
        rows={6}
        aria-label="JSON برای درون‌ریزی"
        placeholder="یا JSON را همین‌جا بچسبان"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      {parsed?.ok === false && (
        <div className="error-sum" role="alert">
          <Icon name="alert" />
          <div>
            <b>{parsed.error}</b>
            {parsed.issues.length > 0 && (
              <ul>
                {parsed.issues.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {parsed?.ok === true && plan !== undefined && (
        <div className="plan">
          <p>
            <b>{num(parsed.ads.length)} آگهی</b>
            {parsed.campaigns.length > 0 && ` و ${num(parsed.campaigns.length)} کمپین`} خوانده شد
            {parsed.source === "bundle" && parsed.version !== undefined
              ? ` (بسته‌ی نسخه‌ی ${num(parsed.version)})`
              : " (فهرست ساده)"}
            .
          </p>
          <div className="radios" role="radiogroup" aria-label="شیوه‌ی درون‌ریزی">
            <label>
              <input
                type="radio"
                name="mode"
                checked={mode === "merge"}
                onChange={() => {
                  setMode("merge");
                }}
              />
              ادغام: افزودن و به‌روز کردن با شناسه
            </label>
            <label>
              <input
                type="radio"
                name="mode"
                checked={mode === "replace"}
                onChange={() => {
                  setMode("replace");
                }}
              />
              جایگزینی: همه‌ی تبلیغ‌های فعلی عوض شوند
            </label>
          </div>
          <p>
            {num(plan.added)} تازه · {num(plan.updated)} به‌روز
            {plan.removed > 0 && <span className="warn"> · {num(plan.removed)} حذف می‌شود</span>}
          </p>
          <button type="button" className="btn" onClick={apply}>
            درون‌ریزی
          </button>
        </div>
      )}
    </section>
  );
}

export function Publish() {
  const { ads: store, toast } = useApp();
  const { ads } = useAds();
  const { campaigns } = useCampaigns();
  const last = useLastBundle();
  const now = new Date();
  const next = buildBundle(ads, last?.version ?? 0, now, campaigns);
  const [digest, setDigest] = useState<{ bytes: number; sha: string } | undefined>();
  const [busy, setBusy] = useState(false);

  const current = last ?? undefined;
  const text = current === undefined ? undefined : shown(current);
  const canonical = current === undefined ? undefined : canonicalJson(current.ads);
  useEffect(() => {
    if (canonical === undefined) {
      setDigest(undefined);
      return;
    }
    let live = true;
    void sha256Hex(canonical).then((sha) => {
      if (live) setDigest({ bytes: new TextEncoder().encode(canonical).length, sha });
    });
    return () => {
      live = false;
    };
  }, [canonical]);

  const unchanged = current !== undefined && canonicalJson(current.ads) === canonicalJson(next.ads);
  const left = ads.length - next.ads.length;
  const crowded = slides().filter((g) =>
    overfilled(slideFilled(g, ads, now, campaignMap(campaigns))),
  );
  const upcoming = next.ads;
  const fromCampaigns = upcoming.filter((a) => a.campaign !== undefined).length;

  const publish = (): void => {
    setBusy(true);
    store.publish().then(
      (b) => {
        setBusy(false);
        toast(
          import.meta.env.DEV
            ? `نسخه‌ی ${num(b.version)} منتشر شد و به نیوتبِ در حال توسعه رسید.`
            : `نسخه‌ی ${num(b.version)} منتشر شد.`,
        );
      },
      () => {
        setBusy(false);
        toast("انتشار نشد.");
      },
    );
  };
  const everything = (): string =>
    JSON.stringify(
      { version: current?.version ?? 0, generatedAt: now.toISOString(), ads, campaigns },
      null,
      2,
    );

  return (
    <>
      <section className="intro">
        <div>
          <h1>انتشار</h1>
          <p>
            انتشار از کمپین‌های در حال اجرا (هر آگهی با سهم نمایشش از روی پیشنهاد قیمت و بودجه) و
            آگهی‌های جدای زنده یک بسته‌ی تازه می‌سازد (نسخه یکی بالا می‌رود). کلاینت‌ها آن را
            می‌گیرند و انتخاب تبلیغ را روی دستگاه خودشان انجام می‌دهند.
          </p>
        </div>
      </section>

      <div className="two">
        <section className="card">
          <h2>انتشار بعدی</h2>
          <dl className="facts roomy">
            <div>
              <dt>نسخه‌ی منتشرشده</dt>
              <dd>
                {current === undefined
                  ? "هنوز منتشر نشده"
                  : `${num(current.version)} · ${timeOf(current.generatedAt)}`}
              </dd>
            </div>
            <div>
              <dt>نسخه‌ی تازه</dt>
              <dd>{num(next.version)}</dd>
            </div>
            <div>
              <dt>تبلیغ در بسته</dt>
              <dd>
                {num(upcoming.length)}
                {fromCampaigns > 0 && (
                  <small> · {num(fromCampaigns)} از کمپین‌ها، با سهم نمایش</small>
                )}
                {left > 0 && (
                  <small> · {num(left)} تبلیغ بیرون می‌ماند (پیش‌نویس، متوقف یا پایان‌یافته)</small>
                )}
              </dd>
            </div>
            <div>
              <dt>نسبت به نسخه‌ی فعلی</dt>
              <dd>{current === undefined ? "—" : unchanged ? "بدون تغییر" : "تغییر کرده"}</dd>
            </div>
          </dl>
          {crowded.map((g) => (
            <p key={g.name} className="notice warn">
              <Icon name="alert" size={16} />
              در اسلاید «{g.name}» بیش از سه جایگاه زنده است؛ هر بار فقط سه‌تایشان نمایش داده
              می‌شود.
            </p>
          ))}
          <p className="notice">
            <Icon name="info" size={16} />
            ذخیره‌ی محلی: انتشار فقط بسته را در همین مرورگر می‌نویسد. با آمدن سرور، این دکمه بسته را
            به <code>POST /v1/admin/ads/publish</code> می‌فرستد و سرور آن را امضا می‌کند.
          </p>
          <button
            type="button"
            className="btn"
            onClick={publish}
            disabled={busy || upcoming.length === 0}
          >
            <Icon name="upload" size={17} />
            انتشار نسخه‌ی {num(next.version)}
          </button>
          {upcoming.length === 0 && (
            <p className="hint">تبلیغ زنده یا زمان‌بندی‌شده‌ای برای انتشار نیست.</p>
          )}
        </section>

        <section className="card">
          <h2>خروجی</h2>
          <p className="note">
            بسته‌ای که منتشر شده همان است که کلاینت می‌گیرد. «همه‌ی تبلیغ‌ها» پیش‌نویس‌ها و متوقف‌ها
            را هم دارد، برای نسخه‌ی پشتیبان یا بردن به جای دیگر.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn ghost"
              disabled={text === undefined}
              onClick={() => {
                if (text !== undefined)
                  download(`ads-bundle-v${String(current?.version ?? 0)}.json`, text);
              }}
            >
              <Icon name="download" size={16} />
              بسته‌ی منتشرشده
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={ads.length === 0}
              onClick={() => {
                download("ads-all.json", everything());
              }}
            >
              <Icon name="download" size={16} />
              همه‌ی تبلیغ‌ها ({num(ads.length)})
            </button>
          </div>
        </section>
      </div>

      <section className="card">
        <h2>
          بسته‌ی منتشرشده
          {current !== undefined && (
            <small>
              {" "}
              نسخه‌ی {num(current.version)} · {jalali(current.generatedAt.slice(0, 10))}
            </small>
          )}
        </h2>
        {text === undefined ? (
          <div className="blank">
            <b>هنوز بسته‌ای منتشر نشده</b>
            <p>با «انتشار» اولین بسته ساخته می‌شود و JSON آن همین‌جا دیده می‌شود.</p>
          </div>
        ) : (
          <>
            <dl className="facts roomy">
              <div>
                <dt>متن امضاشونده</dt>
                <dd>
                  JSON استاندارد فیلد <code>ads</code>
                  {digest !== undefined && <small> · {num(digest.bytes)} بایت</small>}
                </dd>
              </div>
              <div>
                <dt>SHA-256</dt>
                <dd dir="ltr" className="mono">
                  {digest?.sha ?? "…"}
                </dd>
              </div>
              <div>
                <dt>امضا</dt>
                <dd dir="ltr" className="mono">
                  {SIGNATURE_PLACEHOLDER} <small>· جای خالی؛ سرور امضا می‌کند</small>
                </dd>
              </div>
            </dl>
            <div className="btn-row">
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  void navigator.clipboard.writeText(text).then(
                    () => {
                      toast("JSON کپی شد.");
                    },
                    () => {
                      toast("کپی نشد.");
                    },
                  );
                }}
              >
                <Icon name="copy" size={15} />
                کپی JSON
              </button>
            </div>
            <pre className="json" dir="ltr">
              {text}
            </pre>
          </>
        )}
      </section>

      <Importer />
    </>
  );
}
