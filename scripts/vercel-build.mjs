#!/usr/bin/env node
/**
 * Script de build para o Vercel.
 * Roda shared e web em sequência, sem Turbo, garantindo que o dist
 * seja gravado em disco em apps/web/dist.
 */
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, cwd = root) {
  console.log(`\n> ${cmd} (cwd: ${cwd})\n`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

// 1. build do pacote shared
run("npx tsc -p tsconfig.json", resolve(root, "packages/shared"));

// 2. build do app web (tsc + vite)
run("npx tsc -b", resolve(root, "apps/web"));
run("npx vite build", resolve(root, "apps/web"));
