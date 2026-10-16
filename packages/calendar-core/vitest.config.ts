import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "calendar-core",
    include: ["test/**/*.test.ts"],
  },
});
