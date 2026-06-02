import { io } from "socket.io-client";

const API = "http://localhost:3001";

async function jpost(path, body) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`POST ${path} → ${r.status}: ${err}`);
  }
  return r.json();
}

function connectAs(token, label) {
  return new Promise((resolve, reject) => {
    const sock = io(API, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    sock.on("connect", () => {
      console.log(`[${label}] conectado, sid=${sock.id}`);
      resolve(sock);
    });
    sock.on("connect_error", (e) => reject(new Error(`[${label}] connect_error: ${e.message}`)));
    sock.on("state", (v) => console.log(`[${label}] ← state:`, v.state.turn, v.state.status, v.state.moveCount, "youAre=", v.youAre));
    sock.on("error", (e) => console.log(`[${label}] ← error:`, e));
    setTimeout(() => reject(new Error(`[${label}] timeout`)), 5000);
  });
}

function waitForState(sock, predicate, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`[${label}] waitForState timeout`)), 3000);
    sock.on("state", (s) => {
      if (predicate(s)) {
        clearTimeout(t);
        resolve(s);
      }
    });
  });
}

async function main() {
  console.log("--- 1) cria sala (X) ---");
  const creator = await jpost("/api/rooms", { name: "ALICE" });
  console.log("sala:", creator.code, "X=", creator.state.turn);

  console.log("--- 2) entra (O) ---");
  const joiner = await jpost(`/api/rooms/${creator.code}/join`, { name: "BOB" });
  console.log("O=", joiner.state.turn, "status=", joiner.state.status);

  console.log("--- 3) conecta WS ---");
  const xSock = await connectAs(creator.token, "X");
  xSock.emit("state", {});
  const oSock = await connectAs(joiner.token, "O");
  oSock.emit("state", {});

  console.log("--- 4) X joga posição 0 ---");
  xSock.emit("move", { pos: 0, id: "e2e-x0" });
  await waitForState(oSock, (v) => v.state.board[0] === "X" && v.state.turn === "O" && v.youAre === "O", "O");
  console.log("✓ O viu X no tabuleiro e está na vez");

  console.log("--- 5) O joga posição 4 ---");
  oSock.emit("move", { pos: 4, id: "e2e-o4" });
  await waitForState(xSock, (v) => v.state.board[4] === "O" && v.state.turn === "X" && v.youAre === "X", "X");
  console.log("✓ X viu O no tabuleiro e está na vez");

  console.log("--- 6) X joga posição 1, O joga 3, X joga 2 (vitória X na linha 0,1,2) ---");
  xSock.emit("move", { pos: 1, id: "e2e-x1" });
  await waitForState(oSock, (v) => v.state.board[1] === "X", "O");
  oSock.emit("move", { pos: 3, id: "e2e-o3" });
  await waitForState(xSock, (v) => v.state.board[3] === "O", "X");
  xSock.emit("move", { pos: 2, id: "e2e-x2" });
  const finalView = await waitForState(oSock, (v) => v.state.status === "finished" && v.state.winner === "X", "O");
  console.log("✓ Jogo terminou. winner=", finalView.state.winner, "line=", finalView.state.line);
  if (finalView.score.X !== 1 || finalView.score.O !== 0 || finalView.score.draws !== 0) {
    throw new Error(`placar errado após rodada 1: ${JSON.stringify(finalView.score)}`);
  }
  console.log("✓ Placar após rodada 1: X=", finalView.score.X, "O=", finalView.score.O, "draws=", finalView.score.draws);

  console.log("--- 7) restart (X) ---");
  xSock.emit("restart", {});
  const restarted = await waitForState(oSock, (v) => v.state.status === "playing" && v.state.moveCount === 0, "O");
  console.log("✓ Jogo reiniciado. status=", restarted.state.status, "moveCount=", restarted.state.moveCount);
  if (restarted.score.X !== 1) {
    throw new Error(`placar não preservado no restart: X=${restarted.score.X}`);
  }
  console.log("✓ Placar preservado no restart: X=", restarted.score.X);

  console.log("--- 8) nova rodada: X vence de novo ---");
  xSock.emit("move", { pos: 0, id: "e2e-r2-x0" });
  await waitForState(oSock, (v) => v.state.board[0] === "X" && v.state.moveCount === 1, "O");
  oSock.emit("move", { pos: 3, id: "e2e-r2-o3" });
  await waitForState(xSock, (v) => v.state.board[3] === "O" && v.state.moveCount === 2, "X");
  xSock.emit("move", { pos: 1, id: "e2e-r2-x1" });
  await waitForState(oSock, (v) => v.state.board[1] === "X" && v.state.moveCount === 3, "O");
  oSock.emit("move", { pos: 4, id: "e2e-r2-o4" });
  await waitForState(xSock, (v) => v.state.board[4] === "O" && v.state.moveCount === 4, "X");
  xSock.emit("move", { pos: 2, id: "e2e-r2-x2" });
  const finalView2 = await waitForState(oSock, (v) => v.state.status === "finished" && v.state.winner === "X" && v.score?.X === 2, "O");
  console.log("✓ Rodada 2 terminou. winner=", finalView2.state.winner, "placar=", JSON.stringify(finalView2.score));

  xSock.disconnect();
  oSock.disconnect();
  console.log("--- E2E OK (com score cumulativo) ---");
  process.exit(0);
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
