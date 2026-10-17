import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "ads-admin",
    include: ["test/**/*.test.ts"],
  },
});
