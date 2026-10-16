import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "tasks",
    include: ["test/**/*.test.ts"],
  },
});
