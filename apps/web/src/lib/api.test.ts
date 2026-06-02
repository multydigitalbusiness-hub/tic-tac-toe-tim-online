import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoom, joinRoom, getHealth } from "./api.js";

const baseUrl = "http://api.test";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("createRoom", () => {
  it("POST /api/rooms com nome e retorna code, token, state, names", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "ABC234",
          token: "jwt.token.here",
          state: { board: [null, null, null, null, null, null, null, null, null], turn: "X", status: "waiting", winner: null, line: null, moveCount: 0 },
          names: { X: "Alice" },
          version: 0,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await createRoom(baseUrl, { name: "Alice" });

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/rooms`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "content-type": "application/json" }),
        body: JSON.stringify({ name: "Alice" }),
      }),
    );
    expect(result.code).toBe("ABC234");
    expect(result.token).toBe("jwt.token.here");
    expect(result.names.X).toBe("Alice");
  });

  it("aceita chamada sem nome", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "ZZZZZZ", token: "t", state: {}, names: {}, version: 0 }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    await createRoom(baseUrl, {});
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/rooms`,
      expect.objectContaining({ body: JSON.stringify({}) }),
    );
  });

  it("lança ApiError com code+message+status em resposta não-2xx", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "VALIDATION_ERROR", message: "invalid name" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(createRoom(baseUrl, { name: "x".repeat(50) })).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "invalid name",
    });
  });

  it("lança ApiError com INTERNAL em erro de rede", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    await expect(createRoom(baseUrl, {})).rejects.toMatchObject({
      status: 0,
      code: "INTERNAL",
    });
  });
});

describe("joinRoom", () => {
  it("POST /api/rooms/:code/join com nome e retorna dados", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "ABC234",
          token: "t2",
          state: { status: "playing" },
          names: { X: "Alice", O: "Bob" },
          version: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await joinRoom(baseUrl, { code: "ABC234", name: "Bob" });
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/rooms/ABC234/join`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Bob" }) }),
    );
    expect(result.code).toBe("ABC234");
    expect(result.token).toBe("t2");
  });

  it("lança ApiError NOT_FOUND (404) quando sala não existe", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "NOT_FOUND", message: "room NOEXST not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(joinRoom(baseUrl, { code: "NOEXST" })).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("lança ApiError ROOM_FULL (409) quando sala cheia", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "ROOM_FULL", message: "room full" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(joinRoom(baseUrl, { code: "ABC234" })).rejects.toMatchObject({
      status: 409,
      code: "ROOM_FULL",
    });
  });
});

describe("getHealth", () => {
  it("GET /health retorna ok+redis", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, redis: "up" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await getHealth(baseUrl);
    expect(result).toEqual({ ok: true, redis: "up" });
  });

  it("lança ApiError quando health check falha (503)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, redis: "down" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(getHealth(baseUrl)).rejects.toMatchObject({ status: 503 });
  });
});
