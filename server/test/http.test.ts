import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "../src/config/http.js";
import { api } from "./helpers.js";

describe("CORS: which websites may call the API (production rules)", () => {
  const prod = { production: true, extraOrigins: ["https://partner.example"] };

  it.each([
    "https://belamondokw.com",
    "https://www.belamondokw.com",
    "https://belamonda.vercel.app",
    "https://belamonda-kco6mpf6l-ctrlteam.vercel.app", // preview deployment
    "https://belamonda-git-refactor-services-ci-ctrlteam.vercel.app", // branch alias
    "https://belamonda.onrender.com",
    "https://partner.example" // CLIENT_ORIGINS
  ])("allows %s", (origin) => {
    expect(isAllowedOrigin(origin, prod)).toBe(true);
  });

  it.each([
    "https://evil.vercel.app",
    "https://belamonda-evil.vercel.app",
    "https://belamonda-x-otherteam.vercel.app",
    "https://evil.onrender.com",
    "https://belamondokw.com.evil.com",
    "https://evilbelamondokw.com",
    "http://localhost:5173" // dev-only
  ])("refuses %s", (origin) => {
    expect(isAllowedOrigin(origin, prod)).toBe(false);
  });

  it("allows localhost during development", () => {
    expect(isAllowedOrigin("http://localhost:5173", { production: false })).toBe(true);
  });

  it("a refused origin gets 403 CORS_FORBIDDEN; an allowed one gets CORS headers", async () => {
    const bad = await api().get("/health").set("Origin", "https://evil.vercel.app");
    expect(bad.status).toBe(403);
    expect(bad.body.error).toBe("CORS_FORBIDDEN");
    const good = await api().get("/health").set("Origin", "https://www.belamondokw.com");
    expect(good.status).toBe(200);
    expect(good.headers["access-control-allow-origin"]).toBe("https://www.belamondokw.com");
  });
});

describe("JSON body size limits", () => {
  const body = (mb: number) => JSON.stringify({ identifier: "x", password: "y", pad: "a".repeat(mb * 1024 * 1024) });

  it("an ordinary route refuses a 3 MB body with 413", async () => {
    const res = await api().post("/auth/login").set("Content-Type", "application/json").send(body(3));
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("PAYLOAD_TOO_LARGE");
  });

  it("an ordinary route still accepts a normal body", async () => {
    const res = await api().post("/auth/login").send({ identifier: "nobody", password: "x" });
    expect(res.status).not.toBe(413);
  });

  it("KYC upload still accepts a 30 MB body (two uncompressed phone photos)", async () => {
    // Unauthenticated, so it stops at auth (401) — but only after the body was accepted.
    const res = await api().post("/kyc/submit").set("Content-Type", "application/json").send(body(30));
    expect(res.status).toBe(401);
  }, 30_000);

  it("upload routes still refuse more than 50 MB", async () => {
    const res = await api().post("/kyc/submit").set("Content-Type", "application/json").send(body(51));
    expect(res.status).toBe(413);
  }, 30_000);

  it.each([
    ["POST", "/cashback-requests/submit"],
    ["POST", "/offers/admin"],
    ["PATCH", "/offers/admin/abc123"],
    ["POST", "/promotions/admin"],
    ["PUT", "/promotions/admin/abc123"],
    ["POST", "/eforms/submit"]
  ])("%s %s keeps the large limit", async (method, path) => {
    const req = method === "POST" ? api().post(path) : method === "PATCH" ? api().patch(path) : api().put(path);
    const res = await req.set("Content-Type", "application/json").send(body(5));
    expect(res.status).not.toBe(413);
  }, 30_000);
});
