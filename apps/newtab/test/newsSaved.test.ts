import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Story } from "../src/news";

vi.mock("../src/platform", () => ({
  load: () => Promise.resolve(undefined),
  save: () => Promise.resolve(),
}));

const { keepSavedFolderOffDefault, saveStory, savedNotes, SAVED_FOLDER } =
  await import("../src/newsSaved");
const { addFolder, addTask, liveLists, taskLists } = await import("../src/noghte/model");
const { records } = await import("../src/noghte/records");

const story: Story = {
  id: "s1",
  title: "خبر",
  summary: "خلاصه",
  image: null,
  source: "منبع",
  category: "tech",
  at: "2026-10-17T10:00:00Z",
  url: "https://example.com/a",
};

describe("saved news: notes only", () => {
  beforeEach(async () => {
    await records.clear();
    await records.open("local");
  });

  it("a saved story's folder holds notes, never tasks", () => {
    saveStory(story);
    const folder = liveLists().find((l) => l.name === SAVED_FOLDER);
    // no new list kind: the app before it would drop the list and move its notes to «شخصی»
    expect(folder?.kind).toBeUndefined();
    expect(folder?.isDefault).toBe(false);
    expect(savedNotes()).toHaveLength(1);
    expect(taskLists().some((l) => l.id === folder?.id)).toBe(false);
    expect(addTask("کار").listId).not.toBe(folder?.id);
  });

  it("a saved-news folder that became the default gives the default to «شخصی»", () => {
    // saved before 2026-10-17 as a browser's first list, so its default
    const old = { ...addFolder(SAVED_FOLDER, "#6FB6F2"), isDefault: true };
    records.write("list", old.id, old);
    addFolder("شخصی", "#5AB0FF");
    keepSavedFolderOffDefault();
    const lists = liveLists();
    expect(lists.find((l) => l.id === old.id)?.isDefault).toBe(false);
    expect(lists.find((l) => l.name === "شخصی")?.isDefault).toBe(true);
    expect(taskLists().map((l) => l.name)).toEqual(["شخصی"]);
  });
});
