import { jwtVerify, SignJWT, errors as joseErrors } from "jose";
import { z } from "zod";

export type RoomRole = "X" | "O";

export type RoomTokenPayload = {
  sub: string;
  code: string;
  role: RoomRole;
};

const payloadSchema = z.object({
  sub: z.string().min(1),
  code: z.string().min(1),
  role: z.enum(["X", "O"]),
});

export type SignOptions = {
  secret: string;
  issuer: string;
  audience: string;
  expiresIn?: string | number;
};

export type VerifyOptions = {
  secret: string;
  issuer: string;
  audience: string;
};

export async function signRoomToken(
  payload: RoomTokenPayload,
  options: SignOptions,
): Promise<string> {
  const { secret, issuer, audience, expiresIn = "1h" } = options;
  const key = new TextEncoder().encode(secret);
  return await new SignJWT({ code: payload.code, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export class InvalidTokenError extends Error {
  constructor(public readonly reason: string) {
    super(`invalid token: ${reason}`);
    this.name = "InvalidTokenError";
  }
}

export async function verifyRoomToken(
  token: string,
  options: VerifyOptions,
): Promise<RoomTokenPayload> {
  const { secret, issuer, audience } = options;
  const key = new TextEncoder().encode(secret);
  try {
    const { payload } = await jwtVerify(token, key, { issuer, audience });
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => i.path.join(".") || "payload").join(", ");
      throw new InvalidTokenError(`missing/invalid fields: ${fields}`);
    }
    return parsed.data;
  } catch (e) {
    if (e instanceof InvalidTokenError) throw e;
    if (e instanceof joseErrors.JWTExpired) throw new InvalidTokenError("expired");
    if (e instanceof joseErrors.JWTClaimValidationFailed) throw new InvalidTokenError(`claim failed: ${e.claim}`);
    if (e instanceof joseErrors.JWSSignatureVerificationFailed) throw new InvalidTokenError("bad signature");
    if (e instanceof joseErrors.JOSEError) throw new InvalidTokenError(e.message);
    throw new InvalidTokenError("unknown");
  }
}
