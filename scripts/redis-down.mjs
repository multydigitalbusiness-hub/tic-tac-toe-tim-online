#!/usr/bin/env node
import { spawn } from "node:child_process";

const p = spawn("docker", ["rm", "-f", "ttt-redis"], { stdio: "inherit" });
p.on("close", (code) => {
  console.log(code === 0 ? "Redis parado." : `Nada a fazer (exit ${code}).`);
  process.exit(0);
});
