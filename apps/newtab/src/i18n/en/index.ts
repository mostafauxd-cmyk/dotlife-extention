import { HOME } from "./home";
import { MONEY } from "./money";
import { NOTES } from "./notes";
import { PLANS } from "./plans";
import { SHELL } from "./shell";

/**
 * English for every Persian text of the page, one file per part of it (each file is a plain
 * `Persian → English` record). A key in two files is a mistake the test catches.
 */
export const PARTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  home: HOME,
  shell: SHELL,
  plans: PLANS,
  notes: NOTES,
  money: MONEY,
};

export const EN: Readonly<Record<string, string>> = Object.assign(
  {},
  ...Object.values(PARTS),
) as Record<string, string>;
