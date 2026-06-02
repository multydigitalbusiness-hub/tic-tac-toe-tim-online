import { z } from "zod";

export class ConfigError extends Error {
  constructor(issues: string[]) {
    super(`Invalid configuration:\n  - ${issues.join("\n  - ")}`);
    this.name = "ConfigError";
  }
}

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  NODE_ENV: z.enum(["development", "production", "test"]),
  REDIS_URL: z.string().url().refine(
    (u) => u.startsWith("redis://") || u.startsWith("rediss://"),
    { message: "must start with redis:// or rediss://" },
  ),
  CORS_ORIGIN: z.string().refine(
    (s) => s.split(",").map((o) => o.trim()).every((o) => {
      try { new URL(o); return true; } catch { return false; }
    }),
    { message: "must be a valid URL (or comma-separated list of URLs)" },
  ),
  JWT_SECRET: z.string().min(32, "must be at least 32 characters"),
  LOG_LEVEL: z.enum(["silent", "fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;
export type AppConfig = {
  port: number;
  nodeEnv: "development" | "production" | "test";
  redisUrl: string;
  corsOrigins: string[];
  jwtSecret: string;
  logLevel: "silent" | "fatal" | "error" | "warn" | "info" | "debug" | "trace";
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new ConfigError(issues);
  }
  const e = result.data;
  return {
    port: e.PORT,
    nodeEnv: e.NODE_ENV,
    redisUrl: e.REDIS_URL,
    corsOrigins: e.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean),
    jwtSecret: e.JWT_SECRET,
    logLevel: e.LOG_LEVEL,
  };
}
