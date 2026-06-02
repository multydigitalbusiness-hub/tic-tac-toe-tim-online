import { render, screen } from "@testing-library/react";
import { Room } from "./Room.tsx";
import { vi } from "vitest";

describe("Room", () => {
  beforeEach(() => {
    vi.mock("../store/gameStore.js", () => ({
      useGameStore: () => ({
        code: "ABC123",
        token: "fake-token",
        state: {
          board: Array(9).fill(null),
          turn: "X",
          status: "playing",
          winner: null,
          line: null,
          moveCount: 0,
        },
        youAre: "X",
        names: { X: "Player1", O: "Player2" },
        version: 0,
        connection: "connected",
        error: null,
        setRoom: vi.fn(),
        updateState: vi.fn(),
        setConnection: vi.fn(),
        setError: vi.fn(),
        reset: vi.fn(),
      }),
    }));
    vi.mock("../hooks/useGameSocket.js", () => ({
      useGameSocket: () => ({
        play: vi.fn(),
        restart: vi.fn(),
      }),
    }));
    vi.mock("../lib/socket.js", () => ({
      getSocket: () => ({
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        disconnect: vi.fn(),
      }),
      apiToWsUrl: () => "ws://localhost:3001",
      disposeSocket: vi.fn(),
    }));
    vi.mock("react-router-dom", () => ({
      useParams: () => ({ code: "ABC123" }),
      useNavigate: () => vi.fn(),
    }));
    vi.mock("react", () => {
      const actual = vi.importActual("react");
      return {
        ...actual,
        useState: vi.fn().mockImplementation((initial) => {
          if (initial === false) {
            // This is for [copied, setCopied] and [shared, setShared]
            return [false, vi.fn()];
          }
          // This is for [socket, setSocket]
          const mockSocket = {
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
            disconnect: vi.fn(),
          };
          return [mockSocket, vi.fn()];
        }),
        useEffect: vi.fn().mockImplementation((fn) => fn()),
        useParams: () => ({ code: "ABC123" }),
        useNavigate: () => vi.fn(),
      };
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("renderiza botão de compartilhamento ao lado do código da sala", async () => {
    render(<Room />);
    const shareButton = await screen.findByRole("button", { name: /compartilhar/i });
    expect(shareButton).toBeInTheDocument();
  });
});