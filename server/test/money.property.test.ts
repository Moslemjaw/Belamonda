// The routes still do KWD arithmetic as parseFloat(...) + toFixed(3). For 3-decimal amounts
// (the only format the app stores) that is exact; this pins it against integer-mils maths,
// so any future change that breaks it (e.g. 4+ decimals sneaking in) fails here.
import { describe, expect, it } from "vitest";
import { kwdToMils, milsToKwd } from "../src/utils/money.js";

function rand(maxMils: number) {
  return Math.floor(Math.random() * maxMils);
}

describe("float KWD maths used in routes == exact integer-mils maths (3-decimal amounts)", () => {
  const N = 20_000;

  it("price + extras − cashback (POS bill)", () => {
    for (let i = 0; i < N; i++) {
      const price = milsToKwd(rand(500_000)), extra = milsToKwd(rand(100_000)), cb = milsToKwd(rand(200_000));
      const viaFloat = Math.max(0, parseFloat(price) + parseFloat(extra) - parseFloat(cb)).toFixed(3);
      const viaMils = milsToKwd(Math.max(0, kwdToMils(price) + kwdToMils(extra) - kwdToMils(cb)));
      expect(viaFloat).toBe(viaMils);
    }
  });

  it("item price × quantity, summed", () => {
    for (let i = 0; i < N; i++) {
      const items = Array.from({ length: 1 + rand(5) }, () => ({ p: milsToKwd(rand(50_000)), q: 1 + rand(9) }));
      const viaFloat = items.reduce((s, it) => s + parseFloat(it.p) * it.q, 0).toFixed(3);
      const viaMils = milsToKwd(items.reduce((s, it) => s + kwdToMils(it.p) * it.q, 0));
      expect(viaFloat).toBe(viaMils);
    }
  });

  it("Math.round(kwd * 1000) used for metrics equals kwdToMils", () => {
    for (let i = 0; i < N; i++) {
      const v = milsToKwd(rand(10_000_000));
      expect(Math.round(parseFloat(v) * 1000)).toBe(kwdToMils(v));
    }
  });
});
