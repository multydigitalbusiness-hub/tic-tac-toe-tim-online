import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { RedisHandle } from "../db/redis.js";

export type HealthDeps = {
  redis: RedisHandle;
};

export const registerHealthRoutes: FastifyPluginAsync<HealthDeps> = async (
  app: FastifyInstance,
  opts,
) => {
  const { redis } = opts;

  app.get("/health", async (_req, reply) => {
    try {
      await redis.ping();
      return reply.code(200).send({ ok: true, redis: "up" });
    } catch (e) {
      app.log.error({ err: e }, "redis health check failed");
      return reply.code(503).send({ ok: false, redis: "down" });
    }
  });
};
