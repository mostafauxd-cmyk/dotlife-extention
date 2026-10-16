import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "event-data",
    include: ["test/**/*.test.ts"],
  },
});
