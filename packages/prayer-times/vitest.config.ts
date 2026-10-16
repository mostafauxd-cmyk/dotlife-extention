import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "prayer-times",
    include: ["test/**/*.test.ts"],
  },
});
