import { describe, it, expect } from "vitest";
import { buildCorsOrigin } from "./cors.js";

type OriginFn = (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => void;

function check(origin: ReturnType<typeof buildCorsOrigin>, value: string | undefined): boolean {
  let allowed = false;
  (origin as OriginFn)(value, (_e, ok) => {
    allowed = ok;
  });
  return allowed;
}

describe("buildCorsOrigin", () => {
  it("permite origem exata da lista", () => {
    const origin = buildCorsOrigin(["https://app.vercel.app"]);
    expect(check(origin, "https://app.vercel.app")).toBe(true);
  });

  it("bloqueia origem fora da lista", () => {
    const origin = buildCorsOrigin(["https://app.vercel.app"]);
    expect(check(origin, "https://evil.com")).toBe(false);
  });

  it("trata padrão com curinga * como subdomínio de preview", () => {
    const origin = buildCorsOrigin(["https://ttt-*.vercel.app"]);
    expect(check(origin, "https://ttt-git-feat-x.vercel.app")).toBe(true);
    expect(check(origin, "https://ttt-abc123.vercel.app")).toBe(true);
  });

  it("o curinga não permite outros domínios", () => {
    const origin = buildCorsOrigin(["https://ttt-*.vercel.app"]);
    expect(check(origin, "https://ttt-abc.evil.app")).toBe(false);
    expect(check(origin, "https://evil.app")).toBe(false);
  });

  it("o curinga não atravessa pontos (sem subdomínios extras)", () => {
    const origin = buildCorsOrigin(["https://ttt-*.vercel.app"]);
    expect(check(origin, "https://ttt-a.b.vercel.app")).toBe(false);
  });

  it("permite requisições sem Origin (curl, same-origin)", () => {
    const origin = buildCorsOrigin(["https://app.vercel.app"]);
    expect(check(origin, undefined)).toBe(true);
  });

  it("suporta múltiplas origens, exatas e com curinga", () => {
    const origin = buildCorsOrigin([
      "http://localhost:5173",
      "https://ttt-*.vercel.app",
    ]);
    expect(check(origin, "http://localhost:5173")).toBe(true);
    expect(check(origin, "https://ttt-preview.vercel.app")).toBe(true);
    expect(check(origin, "https://other.com")).toBe(false);
  });
});
