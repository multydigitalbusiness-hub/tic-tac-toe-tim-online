import { describe, it, expect } from "vitest";
import { apiToWsUrl } from "./socket.js";

describe("apiToWsUrl", () => {
  it("converte http:// para ws://", () => {
    expect(apiToWsUrl("http://localhost:3001")).toBe("ws://localhost:3001");
  });

  it("converte https:// para wss://", () => {
    expect(apiToWsUrl("https://api.example.com")).toBe("wss://api.example.com");
  });

  it("converte Fly.io URL https → wss", () => {
    expect(apiToWsUrl("https://tic-tac-toe-tim-online.fly.dev")).toBe(
      "wss://tic-tac-toe-tim-online.fly.dev",
    );
  });
});
