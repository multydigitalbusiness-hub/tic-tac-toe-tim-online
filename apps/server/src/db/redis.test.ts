import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { createRedis, type RedisHandle } from "./redis.js";

const URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";

let handle: RedisHandle;

beforeAll(async () => {
  handle = createRedis({ url: URL, keyPrefix: "test:" });
  await handle.ping();
});

afterAll(async () => {
  await handle.client.flushdb();
  await handle.close();
});

describe("createRedis", () => {
  it("conecta e responde PONG", async () => {
    expect(await handle.ping()).toBe("PONG");
  });

  it("aplica keyPrefix nas chaves de escrita/leitura", async () => {
    await handle.client.set("greeting", "hello");
    expect(await handle.client.get("greeting")).toBe("hello");
    expect(await handle.client.get("greeting")).not.toBeNull();
  });

  it("expõe operações de string com TTL", async () => {
    await handle.client.set("temp", "value", "EX", 1);
    expect(await handle.client.get("temp")).toBe("value");
    expect(await handle.client.ttl("temp")).toBeGreaterThan(0);
  });

  it("expõe operações de hash (hset/hgetall/hdel)", async () => {
    await handle.client.hset("h:1", { a: "1", b: "2", c: "3" });
    expect(await handle.client.hgetall("h:1")).toEqual({ a: "1", b: "2", c: "3" });
    expect(await handle.client.hget("h:1", "b")).toBe("2");
    await handle.client.hdel("h:1", "c");
    expect(await handle.client.hget("h:1", "c")).toBeNull();
  });

  it("expõe operação exists", async () => {
    await handle.client.set("ex:k", "1");
    expect(await handle.client.exists("ex:k")).toBe(1);
    expect(await handle.client.exists("ex:missing")).toBe(0);
  });

  it("expõe operação del com retorno de contagem", async () => {
    await handle.client.set("d:1", "1");
    await handle.client.set("d:2", "2");
    expect(await handle.client.del("d:1", "d:2", "d:missing")).toBe(2);
  });
});
