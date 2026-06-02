import puppeteer from "puppeteer-core";

const PREVIEW = "http://127.0.0.1:4173";
const API = "http://localhost:3001";

async function jpost(path, body) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
  defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 2 },
});

async function shoot(name, url, opts = {}) {
  const page = await browser.newPage();
  if (opts.viewport) await page.setViewport(opts.viewport);
  if (opts.initStore) {
    await page.evaluateOnNewDocument((data) => {
      window.__INIT_STORE__ = data;
    }, opts.initStore);
  }
  await page.goto(PREVIEW + url, { waitUntil: "domcontentloaded" });
  if (opts.before) await opts.before(page);
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `/tmp/ttt-shots/${name}.png`, fullPage: false });
  console.log(`✓ ${name}`);
  await page.close();
}

// 1) Home clean
await shoot("01-home", "/");

// 2) Home com nome digitado
await shoot("02-home-com-nome", "/", {
  before: async (page) => {
    await page.type("#name", "TIM");
    await new Promise((r) => setTimeout(r, 300));
  },
});

// Cria sala real
const creator = await jpost("/api/rooms", { name: "ALICE" });
const joiner = await jpost(`/api/rooms/${creator.code}/join`, { name: "BOB" });

// 3) Room como X, sua vez (X joga primeiro → turn=X, status=playing)
await shoot("03-room-x-vez", `/r/${creator.code}`, {
  initStore: { code: creator.code, token: creator.token, state: joiner.state, score: { X: 0, O: 0, draws: 0 }, youAre: "X", names: joiner.names, version: 0 },
});

// 4) Room como X, jogada parcial
const { newGame, applyMove } = await import("@ttt/shared");
let stateMid = newGame();
stateMid = applyMove(stateMid, 0, "X");
const midNames = { X: "ALICE", O: "BOB" };
await shoot("04-room-x-parcial", `/r/${creator.code}`, {
  initStore: { code: creator.code, token: creator.token, state: stateMid, score: { X: 0, O: 0, draws: 0 }, youAre: "X", names: midNames, version: 1 },
});

// 5) Room com vitória de X
let stateWon = newGame();
stateWon = applyMove(stateWon, 0, "X");
stateWon = applyMove(stateWon, 3, "O");
stateWon = applyMove(stateWon, 1, "X");
stateWon = applyMove(stateWon, 4, "O");
stateWon = applyMove(stateWon, 2, "X");
await shoot("05-room-x-venceu", `/r/${creator.code}`, {
  initStore: { code: creator.code, token: creator.token, state: stateWon, score: { X: 1, O: 0, draws: 0 }, youAre: "X", names: midNames, version: 5 },
});

// 6) Room como O, perdeu
await shoot("06-room-o-perdeu", `/r/${creator.code}`, {
  initStore: { code: creator.code, token: joiner.token, state: stateWon, score: { X: 1, O: 0, draws: 0 }, youAre: "O", names: midNames, version: 5 },
});

// 7) Mobile home
await shoot("07-mobile-home", "/", {
  viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
});

// 8) Mobile room
await shoot("08-mobile-room", `/r/${creator.code}`, {
  viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
  initStore: { code: creator.code, token: creator.token, state: stateMid, score: { X: 0, O: 0, draws: 0 }, youAre: "X", names: midNames, version: 1 },
});

await browser.close();
console.log("DONE");
