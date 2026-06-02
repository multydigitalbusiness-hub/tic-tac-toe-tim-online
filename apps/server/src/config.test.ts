import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "./config.js";

const baseEnv = {
  PORT: "3001",
  NODE_ENV: "development",
  REDIS_URL: "redis://localhost:6379",
  CORS_ORIGIN: "http://localhost:5173",
  JWT_SECRET: "test-secret-32-chars-minimum-please",
};

describe("loadConfig", () => {
  it("carrega config válida com defaults sensatos", () => {
    const cfg = loadConfig(baseEnv);
    expect(cfg.port).toBe(3001);
    expect(cfg.nodeEnv).toBe("development");
    expect(cfg.redisUrl).toBe("redis://localhost:6379");
    expect(cfg.corsOrigins).toEqual(["http://localhost:5173"]);
    expect(cfg.jwtSecret).toBe(baseEnv.JWT_SECRET);
    expect(cfg.logLevel).toBe("info");
  });

  it("converte PORT para número", () => {
    const cfg = loadConfig({ ...baseEnv, PORT: "4000" });
    expect(cfg.port).toBe(4000);
  });

  it("rejeita PORT não-numérico", () => {
    expect(() => loadConfig({ ...baseEnv, PORT: "abc" })).toThrow(ConfigError);
  });

  it("rejeita PORT fora do range válido", () => {
    expect(() => loadConfig({ ...baseEnv, PORT: "0" })).toThrow(ConfigError);
    expect(() => loadConfig({ ...baseEnv, PORT: "70000" })).toThrow(ConfigError);
  });

  it("rejeita NODE_ENV inválido", () => {
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: "staging" })).toThrow(ConfigError);
  });

  it("rejeita REDIS_URL sem protocolo redis://", () => {
    expect(() => loadConfig({ ...baseEnv, REDIS_URL: "http://redis" })).toThrow(ConfigError);
  });

  it("aceita REDIS_URL com protocolo rediss:// (Upstash TLS)", () => {
    const cfg = loadConfig({
      ...baseEnv,
      REDIS_URL: "rediss://default:secret@us1-xyz.upstash.io:6379",
    });
    expect(cfg.redisUrl).toBe("rediss://default:secret@us1-xyz.upstash.io:6379");
  });

  it("rejeita CORS_ORIGIN com URL inválida", () => {
    expect(() => loadConfig({ ...baseEnv, CORS_ORIGIN: "not-a-url" })).toThrow(ConfigError);
  });

  it("rejeita JWT_SECRET com menos de 32 caracteres", () => {
    expect(() => loadConfig({ ...baseEnv, JWT_SECRET: "short" })).toThrow(ConfigError);
  });

  it("parseia múltiplas origens CORS separadas por vírgula", () => {
    const cfg = loadConfig({
      ...baseEnv,
      CORS_ORIGIN: "http://localhost:5173,https://ttt.vercel.app",
    });
    expect(cfg.corsOrigins).toEqual([
      "http://localhost:5173",
      "https://ttt.vercel.app",
    ]);
  });

  it("aceita LOG_LEVEL customizado", () => {
    const cfg = loadConfig({ ...baseEnv, LOG_LEVEL: "debug" });
    expect(cfg.logLevel).toBe("debug");
  });

  it("lança ConfigError com lista de problemas em erros agregados", () => {
    try {
      loadConfig({
        PORT: "abc",
        NODE_ENV: "staging",
        REDIS_URL: "invalid",
        CORS_ORIGIN: "x",
        JWT_SECRET: "short",
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      const msg = (e as Error).message;
      expect(msg).toMatch(/PORT/);
      expect(msg).toMatch(/NODE_ENV/);
      expect(msg).toMatch(/REDIS_URL/);
      expect(msg).toMatch(/CORS_ORIGIN/);
      expect(msg).toMatch(/JWT_SECRET/);
    }
  });
});
