import { describe, it, expect } from "vitest";
import { generateRoomCode, isValidRoomCode } from "./protocol.js";

describe("generateRoomCode", () => {
  it("gera string de 6 caracteres por padrão", () => {
    expect(generateRoomCode()).toHaveLength(6);
  });

  it("respeita o tamanho customizado", () => {
    expect(generateRoomCode(8)).toHaveLength(8);
    expect(generateRoomCode(4)).toHaveLength(4);
  });

  it("usa apenas caracteres do alfabeto sem ambiguidade (sem I, O, 0, 1)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    }
  });

  it("gera códigos diferentes em chamadas consecutivas", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(95);
  });
});

describe("isValidRoomCode", () => {
  it.each(["ABC234", "XYZWQR", "ZZZZZZ", "222222"])("aceita código válido: %s", (code) => {
    expect(isValidRoomCode(code)).toBe(true);
  });

  it.each([
    ["ABC12", "muito curto"],
    ["ABC1234", "muito longo"],
    ["abc123", "minúsculo"],
    ["ABC12I", "contém I"],
    ["ABC12O", "contém O"],
    ["ABC120", "contém 0"],
    ["ABC121", "contém 1"],
    ["ABC-23", "contém hífen"],
    ["", "vazio"],
  ])("rejeita código inválido: %s (%s)", (code) => {
    expect(isValidRoomCode(code)).toBe(false);
  });
});
