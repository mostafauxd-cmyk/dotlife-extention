import { describe, expect, it } from "vitest";

import { meetBlock, meetIn, withMeet, withoutMeet } from "../src/google";

const URL = "https://meet.google.com/abc-defg-hij";

describe("a Meet link in a task's notes", () => {
  it("is written as the app writes it, under the person's text", () => {
    const notes = withMeet("دستور جلسه", URL);
    expect(notes).toBe(`دستور جلسه\n\n${meetBlock(URL)}`);
    expect(meetIn(notes)).toBe(URL);
  });

  it("stays out of the text the form shows", () => {
    expect(withoutMeet(withMeet("دستور جلسه", URL))).toBe("دستور جلسه");
    expect(withoutMeet(`یک خط\nJoin: ${URL}`)).toBe("یک خط");
  });

  it("leaves notes without a link alone", () => {
    expect(withMeet("فقط متن", "")).toBe("فقط متن");
    expect(meetIn("https://zoom.us/j/1")).toBe("");
  });
});
