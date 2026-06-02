import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { Server as SocketIOServer } from "socket.io";
import { createRedis, type RedisHandle } from "./db/redis.js";
import { loadConfig, type AppConfig } from "./config.js";
import { registerHealthRoutes } from "./http/routes.js";
import { setupSocketAuth } from "./ws/hub.js";

export type ServerDeps = {
  config: AppConfig;
  redis?: RedisHandle;
};

export type ServerHandle = {
  app: FastifyInstance;
  io: SocketIOServer;
  redis: RedisHandle;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  address: () => { port: number; address: string };
};

export async function createServer(deps: ServerDeps): Promise<ServerHandle> {
  const { config } = deps;
  const redis = deps.redis ?? createRedis({ url: config.redisUrl, keyPrefix: "ttt:" });
  await redis.ping();

  const app = Fastify({
    logger: config.logLevel === "silent"
      ? false
      : { level: config.logLevel },
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  await app.register(registerHealthRoutes, { redis });

  const io = new SocketIOServer(app.server, {
    cors: { origin: config.corsOrigins, credentials: true },
    transports: ["websocket", "polling"],
  });

  setupSocketAuth(io, {
    secret: config.jwtSecret,
    issuer: "ttt-server",
    audience: "ttt-room",
  }, {
    info: (obj, msg) => app.log.info(obj, msg),
  });

  return {
    app,
    io,
    redis,
    start: async () => {
      await app.listen({ port: config.port, host: "0.0.0.0" });
    },
    stop: async () => {
      io.close();
      await app.close();
      if (!deps.redis) await redis.close();
    },
    address: () => {
      const addr = app.server.address();
      if (addr && typeof addr === "object") {
        return { port: addr.port, address: addr.address };
      }
      return { port: config.port, address: "0.0.0.0" };
    },
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const config = loadConfig();
  const handle = await createServer({ config });
  await handle.start();
  handle.app.log.info(
    { port: handle.address().port, env: config.nodeEnv },
    "server started",
  );

  const shutdown = async (signal: string) => {
    handle.app.log.info({ signal }, "shutting down");
    await handle.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
