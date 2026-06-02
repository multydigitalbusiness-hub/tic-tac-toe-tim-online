import type { GameState, Score } from "@ttt/shared";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type RoomResponse = {
  code: string;
  token: string;
  state: GameState;
  score: Score;
  names: { X?: string; O?: string };
  version: number;
};

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    throw new ApiError(0, "INTERNAL", e instanceof Error ? e.message : "network error");
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try { body = JSON.parse(text); } catch { body = { message: text }; }
  }

  if (!res.ok) {
    const obj = (body && typeof body === "object" ? body : {}) as { code?: string; message?: string };
    throw new ApiError(
      res.status,
      obj.code ?? "HTTP_ERROR",
      obj.message ?? `HTTP ${res.status}`,
    );
  }

  return body as T;
}

export type CreateRoomInput = { name?: string };
export type JoinRoomInput = { code: string; name?: string };

export function createRoom(baseUrl: string, input: CreateRoomInput): Promise<RoomResponse> {
  return request<RoomResponse>(`${baseUrl}/api/rooms`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function joinRoom(baseUrl: string, input: JoinRoomInput): Promise<RoomResponse> {
  return request<RoomResponse>(`${baseUrl}/api/rooms/${encodeURIComponent(input.code)}/join`, {
    method: "POST",
    body: JSON.stringify({ name: input.name }),
  });
}

export type HealthResponse = { ok: boolean; redis: "up" | "down" };
export function getHealth(baseUrl: string): Promise<HealthResponse> {
  return request<HealthResponse>(`${baseUrl}/health`);
}
