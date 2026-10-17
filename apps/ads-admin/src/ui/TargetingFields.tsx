import { AD_CITIES, AD_PERSONAS, AD_SEASONS, AD_TOPICS, type Target } from "@dotlife/ads";

import { TARGET_LABEL } from "../data/labels";
import { ChipSet, Field, TagInput } from "./Fields";

/** Who and when, as the forms hold it. */
export type TargetingValue = {
  persona: string[];
  city: string[];
  season: string[];
  occasion: string[];
  keyword: string[];
  topic: string[];
  weekend: boolean;
};

/**
 * The targeting fields, only for the dimensions `allowed`: chips for the closed sets (persona,
 * season), free words with suggestions for the rest. Errors are read as `<prefix><dim>`.
 */
export function TargetingFields({
  allowed,
  value,
  onChange,
  errors = {},
  prefix = "targeting.",
}: {
  allowed: ReadonlySet<Target>;
  value: TargetingValue;
  onChange: (patch: Partial<TargetingValue>) => void;
  errors?: Record<string, string>;
  prefix?: string;
}) {
  if (allowed.size === 0)
    return <p className="note">این جایگاه‌ها هدف‌گیری ندارند: برای همه نمایش داده می‌شود.</p>;
  const err = (dim: Target): string | undefined => errors[`${prefix}${dim}`];
  return (
    <div className="fields">
      {allowed.has("persona") && (
        <Field label={TARGET_LABEL.persona} error={err("persona")} hint="خالی یعنی همه." wide>
          {() => (
            <ChipSet
              label={TARGET_LABEL.persona}
              items={AD_PERSONAS.map((p) => ({ id: p.id, label: p.name }))}
              value={value.persona}
              onChange={(v) => {
                onChange({ persona: v });
              }}
            />
          )}
        </Field>
      )}
      {allowed.has("season") && (
        <Field
          label={TARGET_LABEL.season}
          error={err("season")}
          hint="خالی یعنی همه‌ی فصل‌ها."
          wide
        >
          {() => (
            <ChipSet
              label={TARGET_LABEL.season}
              items={AD_SEASONS.map((s) => ({ id: s.id, label: s.name }))}
              value={value.season}
              onChange={(v) => {
                onChange({ season: v });
              }}
            />
          )}
        </Field>
      )}
      {allowed.has("city") && (
        <Field
          label={TARGET_LABEL.city}
          error={err("city")}
          hint="با Enter یا ویرگول اضافه کن؛ خالی یعنی همه‌ی شهرها."
        >
          {(id) => (
            <TagInput
              id={id}
              value={value.city}
              suggestions={AD_CITIES}
              placeholder="مثلاً تهران"
              onChange={(v) => {
                onChange({ city: v });
              }}
            />
          )}
        </Field>
      )}
      {allowed.has("occasion") && (
        <Field
          label={TARGET_LABEL.occasion}
          error={err("occasion")}
          hint="عنوان مناسبت همان‌طور که در تقویم آمده؛ خالی یعنی همه‌ی روزها."
        >
          {(id) => (
            <TagInput
              id={id}
              value={value.occasion}
              placeholder="مثلاً روز ملی کتاب"
              onChange={(v) => {
                onChange({ occasion: v });
              }}
            />
          )}
        </Field>
      )}
      {allowed.has("keyword") && (
        <Field
          label={TARGET_LABEL.keyword}
          error={err("keyword")}
          hint="وقتی کاربر یکی از این‌ها را بنویسد؛ خالی یعنی هر جستجو."
        >
          {(id) => (
            <TagInput
              id={id}
              value={value.keyword}
              placeholder="مثلاً قطار"
              onChange={(v) => {
                onChange({ keyword: v });
              }}
            />
          )}
        </Field>
      )}
      {allowed.has("topic") && (
        <Field label={TARGET_LABEL.topic} error={err("topic")} hint="خالی یعنی همه‌ی موضوع‌ها.">
          {(id) => (
            <TagInput
              id={id}
              value={value.topic}
              suggestions={AD_TOPICS}
              placeholder="مثلاً سفر"
              onChange={(v) => {
                onChange({ topic: v });
              }}
            />
          )}
        </Field>
      )}
      {allowed.has("weekend") && (
        <label className="switch wide">
          <input
            type="checkbox"
            checked={value.weekend}
            onChange={(e) => {
              onChange({ weekend: e.target.checked });
            }}
          />
          <span>فقط آخر هفته (پنجشنبه و جمعه)</span>
        </label>
      )}
    </div>
  );
}
