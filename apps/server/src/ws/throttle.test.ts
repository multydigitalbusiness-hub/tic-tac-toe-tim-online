import { describe, it, expect } from "vitest";
import { createTokenBucket } from "./throttle.js";

describe("createTokenBucket", () => {
  it("permite até `capacity` ações imediatas e bloqueia a seguinte", () => {
    let now = 1000;
    const bucket = createTokenBucket({ capacity: 3, refillPerSecond: 1, now: () => now });
    expect(bucket.tryRemove("a")).toBe(true);
    expect(bucket.tryRemove("a")).toBe(true);
    expect(bucket.tryRemove("a")).toBe(true);
    expect(bucket.tryRemove("a")).toBe(false);
  });

  it("recarrega tokens com o passar do tempo", () => {
    let now = 1000;
    const bucket = createTokenBucket({ capacity: 2, refillPerSecond: 2, now: () => now });
    expect(bucket.tryRemove("a")).toBe(true);
    expect(bucket.tryRemove("a")).toBe(true);
    expect(bucket.tryRemove("a")).toBe(false);
    now += 1000; // 1s => +2 tokens
    expect(bucket.tryRemove("a")).toBe(true);
    expect(bucket.tryRemove("a")).toBe(true);
    expect(bucket.tryRemove("a")).toBe(false);
  });

  it("rastreia chaves independentes", () => {
    let now = 1000;
    const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 1, now: () => now });
    expect(bucket.tryRemove("a")).toBe(true);
    expect(bucket.tryRemove("b")).toBe(true);
    expect(bucket.tryRemove("a")).toBe(false);
    expect(bucket.tryRemove("b")).toBe(false);
  });

  it("não acumula além da capacidade", () => {
    let now = 1000;
    const bucket = createTokenBucket({ capacity: 2, refillPerSecond: 5, now: () => now });
    bucket.tryRemove("a");
    bucket.tryRemove("a");
    now += 10000; // muito tempo, mas cap é 2
    expect(bucket.tryRemove("a")).toBe(true);
    expect(bucket.tryRemove("a")).toBe(true);
    expect(bucket.tryRemove("a")).toBe(false);
  });

  it("libera estado de uma chave com drop()", () => {
    const now = 1000;
    const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 1, now: () => now });
    expect(bucket.tryRemove("a")).toBe(true);
    expect(bucket.tryRemove("a")).toBe(false);
    bucket.drop("a");
    expect(bucket.tryRemove("a")).toBe(true);
  });
});
