import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { signRoomToken, verifyRoomToken, type RoomRole } from "./jwt.js";

const SECRET = "test-secret-at-least-32-characters-long-for-jose";
const ISSUER = "ttt-server";
const AUDIENCE = "ttt-room";

async function makeToken(payload: object, expiresIn: string = "1h") {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(SECRET));
}

describe("signRoomToken", () => {
  it("gera token JWT válido com payload correto", async () => {
    const token = await signRoomToken(
      { sub: "user-1", code: "ABC234", role: "X" as RoomRole },
      { secret: SECRET, issuer: ISSUER, audience: AUDIENCE },
    );
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("token gerado é verificável por verifyRoomToken", async () => {
    const token = await signRoomToken(
      { sub: "user-1", code: "ABC234", role: "O" as RoomRole },
      { secret: SECRET, issuer: ISSUER, audience: AUDIENCE },
    );
    const payload = await verifyRoomToken(token, { secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
    expect(payload.sub).toBe("user-1");
    expect(payload.code).toBe("ABC234");
    expect(payload.role).toBe("O");
  });
});

describe("verifyRoomToken", () => {
  it("retorna payload decodificado para token válido", async () => {
    const token = await makeToken({ sub: "u", code: "XYZ234", role: "X" });
    const payload = await verifyRoomToken(token, { secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
    expect(payload.sub).toBe("u");
    expect(payload.code).toBe("XYZ234");
    expect(payload.role).toBe("X");
  });

  it("lança erro em token com assinatura inválida", async () => {
    const token = await makeToken({ sub: "u", code: "ABC234", role: "X" });
    await expect(
      verifyRoomToken(token, { secret: "outro-segredo-tambem-32-chars-min", issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toThrow();
  });

  it("lança erro em token expirado", async () => {
    const token = await makeToken({ sub: "u", code: "ABC234", role: "X" }, "-1s");
    await expect(
      verifyRoomToken(token, { secret: SECRET, issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toThrow();
  });

  it("lança erro quando issuer é diferente", async () => {
    const token = await makeToken({ sub: "u", code: "ABC234", role: "X" });
    await expect(
      verifyRoomToken(token, { secret: SECRET, issuer: "outro", audience: AUDIENCE }),
    ).rejects.toThrow();
  });

  it("lança erro quando audience é diferente", async () => {
    const token = await makeToken({ sub: "u", code: "ABC234", role: "X" });
    await expect(
      verifyRoomToken(token, { secret: SECRET, issuer: ISSUER, audience: "outro" }),
    ).rejects.toThrow();
  });

  it("lança erro em string que não é JWT", async () => {
    await expect(
      verifyRoomToken("not-a-jwt", { secret: SECRET, issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toThrow();
  });

  it("lança erro em JWT com payload faltando campos obrigatórios", async () => {
    const token = await makeToken({ sub: "u" });
    await expect(
      verifyRoomToken(token, { secret: SECRET, issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toThrow(/code|role/);
  });

  it("lança erro em JWT com role inválido", async () => {
    const token = await makeToken({ sub: "u", code: "ABC234", role: "Z" });
    await expect(
      verifyRoomToken(token, { secret: SECRET, issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toThrow(/role/);
  });
});
