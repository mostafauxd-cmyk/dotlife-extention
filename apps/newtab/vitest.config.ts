import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "newtab",
    include: ["test/**/*.test.ts"],
  },
});
