import { AD_CITIES, AD_TOPICS } from "@dotlife/ads";
import { describe, expect, it } from "vitest";

import { CITIES, INTERESTS } from "../src/cities";

describe("the ads' vocabulary", () => {
  it("offers the advertisers exactly the cities and interests a person can choose here", () => {
    expect([...AD_CITIES]).toEqual([...CITIES]);
    expect([...AD_TOPICS]).toEqual([...INTERESTS]);
  });
});
