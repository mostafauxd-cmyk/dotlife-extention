import { describe, expect, it } from "vitest";

import { assertNever } from "../src";

type Shape = { kind: "circle" } | { kind: "square" };

function label(shape: Shape): string {
  switch (shape.kind) {
    case "circle":
      return "دایره";
    case "square":
      return "مربع";
    default:
      return assertNever(shape);
  }
}

describe("assertNever", () => {
  it("is unreachable for handled members", () => {
    expect(label({ kind: "circle" })).toBe("دایره");
    expect(label({ kind: "square" })).toBe("مربع");
  });

  it("throws with the offending value when reached at runtime", () => {
    expect(() => assertNever("oops" as never)).toThrow('Unexpected value: "oops"');
  });
});
