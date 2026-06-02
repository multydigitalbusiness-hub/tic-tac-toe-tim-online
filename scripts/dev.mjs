#!/usr/bin/env node
/**
 * Orquestrador do ambiente de desenvolvimento.
 * Sobe Redis (Docker), backend (Node + Socket.IO) e frontend (Vite)
 * em processos paralelos com logs etiquetados.
 * Ctrl+C derruba tudo de forma limpa.
 */
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const REDIS_CONTAINER = "ttt-redis";
const REDIS_PORT = "6379";

const procs = [];
let exiting = false;

const palette = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function tag(color, label) {
  return `${color}[${label.padEnd(5)}]${palette.reset}`;
}

function prefixStream(stream, color, label) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      process.stdout.write(`${tag(color, label)} ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffer) process.stdout.write(`${tag(color, label)} ${buffer}\n`);
  });
}

async function ensureRedis() {
  console.log(`${tag(palette.cyan, "redis")} verificando container...`);
  const check = spawn("docker", ["inspect", "-f", "{{.State.Running}}", REDIS_CONTAINER], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const isRunning = await new Promise((resolve) => {
    let out = "";
    check.stdout.on("data", (c) => (out += c.toString()));
    check.on("close", () => resolve(out.trim() === "true"));
    check.on("error", () => resolve(false));
  });

  if (isRunning) {
    console.log(`${tag(palette.cyan, "redis")} já está rodando`);
    return;
  }

  const rm = spawn("docker", ["rm", "-f", REDIS_CONTAINER], { stdio: "ignore" });
  await new Promise((r) => rm.on("close", r));

  console.log(`${tag(palette.cyan, "redis")} iniciando container na porta ${REDIS_PORT}...`);
  const run = spawn(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--name", REDIS_CONTAINER,
      "-p", `${REDIS_PORT}:6379`,
      "-v", "ttt-redis-data:/data",
      "redis:7-alpine",
      "redis-server", "--appendonly", "yes",
    ],
    { stdio: "inherit" }
  );
  await new Promise((resolve, reject) => {
    run.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`docker run exit ${code}`))));
  });

  for (let i = 0; i < 20; i++) {
    await wait(250);
    const ping = spawn("docker", ["exec", REDIS_CONTAINER, "redis-cli", "ping"], { stdio: ["ignore", "pipe", "pipe"] });
    const ok = await new Promise((resolve) => {
      let out = "";
      ping.stdout.on("data", (c) => (out += c.toString()));
      ping.on("close", () => resolve(out.trim() === "PONG"));
      ping.on("error", () => resolve(false));
    });
    if (ok) {
      console.log(`${tag(palette.cyan, "redis")} pronto (PONG)`);
      return;
    }
  }
  throw new Error("Redis não respondeu ao PING em 5s");
}

function startProc(name, color, cmd, args) {
  const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
  procs.push({ name, p });
  prefixStream(p.stdout, color, name);
  prefixStream(p.stderr, color, name);
  p.on("close", (code) => {
    if (!exiting) {
      console.log(`${tag(color, name)} saiu com código ${code}`);
      shutdown(code ?? 1);
    }
  });
  return p;
}

function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  console.log(`\n${tag(palette.gray, "dev")} encerrando processos...`);
  for (const { p } of procs) {
    if (!p.killed) p.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

(async () => {
  try {
    await ensureRedis();
  } catch (e) {
    console.error(`${tag(palette.red, "redis")} ${e.message}`);
    process.exit(1);
  }
  startProc("api", palette.green, "pnpm", ["--filter", "@ttt/server", "dev"]);
  startProc("web", palette.blue, "pnpm", ["--filter", "@ttt/web", "dev"]);
  console.log(`${tag(palette.gray, "dev")} tudo no ar. Ctrl+C para parar.`);
})();
