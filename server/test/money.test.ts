import { describe, expect, it } from "vitest";
import { kwdToMils, milsToKwd } from "../src/utils/money.js";

describe("money", () => {
  it("parses KWD strings into mils", () => {
    expect(kwdToMils("12.500")).toBe(12500);
    expect(kwdToMils("0.005")).toBe(5);
    expect(kwdToMils("7")).toBe(7000);
    expect(kwdToMils("1.5")).toBe(1500);
    expect(kwdToMils("-2.250")).toBe(-2250);
    expect(kwdToMils(undefined)).toBe(0);
    expect(kwdToMils(null)).toBe(0);
    expect(kwdToMils("")).toBe(0);
  });

  it("rounds float KWD numbers to the nearest mil", () => {
    expect(kwdToMils(0.1 + 0.2)).toBe(300);
    expect(kwdToMils(12.5)).toBe(12500);
  });

  it("formats mils as 3-decimal KWD", () => {
    expect(milsToKwd(12500)).toBe("12.500");
    expect(milsToKwd(5)).toBe("0.005");
    expect(milsToKwd(0)).toBe("0.000");
    expect(milsToKwd(-2250)).toBe("-2.250");
  });
});
