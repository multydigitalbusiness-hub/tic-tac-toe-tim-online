#!/usr/bin/env node
/**
 * Sobe o container Redis (uso manual: pnpm redis:up).
 */
import { spawn } from "node:child_process";

const NAME = "ttt-redis";
const PORT = "6379";

const run = (args, opts = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(args[0], args.slice(1), { stdio: "inherit", ...opts });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });

(async () => {
  try {
    await run(["docker", "rm", "-f", NAME], { stdio: "ignore" });
  } catch {}
  await run([
    "docker", "run", "-d", "--rm",
    "--name", NAME,
    "-p", `${PORT}:6379`,
    "-v", "ttt-redis-data:/data",
    "redis:7-alpine",
    "redis-server", "--appendonly", "yes",
  ]);
  console.log(`Redis rodando em localhost:${PORT} (container: ${NAME})`);
  console.log(`Para parar: pnpm redis:down`);
})();
