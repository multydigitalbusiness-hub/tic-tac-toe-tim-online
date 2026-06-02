import { Redis } from "ioredis";
import { z } from "zod";

const configSchema = z.object({
  url: z.string().url(),
  keyPrefix: z.string().optional(),
});

export type RedisConfig = z.infer<typeof configSchema>;

export type RedisHandle = {
  client: Redis;
  ping: () => Promise<"PONG">;
  close: () => Promise<void>;
};

export function createRedis(config: RedisConfig): RedisHandle {
  const parsed = configSchema.parse(config);
  const client = new Redis(parsed.url, {
    keyPrefix: parsed.keyPrefix,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  return {
    client,
    ping: async () => {
      const reply = await client.ping();
      if (reply !== "PONG") throw new Error(`unexpected ping reply: ${reply}`);
      return "PONG";
    },
    close: async () => {
      await client.quit();
    },
  };
}
