export type TokenBucketOptions = {
  /** Número máximo de tokens (rajada permitida). */
  capacity: number;
  /** Tokens recarregados por segundo. */
  refillPerSecond: number;
  /** Fonte de tempo injetável (ms). Default: Date.now. */
  now?: () => number;
};

export type TokenBucket = {
  /** Tenta consumir 1 token para `key`. Retorna true se permitido. */
  tryRemove: (key: string) => boolean;
  /** Remove o estado de uma chave (ex.: socket desconectou). */
  drop: (key: string) => void;
};

type BucketState = {
  tokens: number;
  last: number;
};

/**
 * Token bucket por chave (ex.: por socket). Usado para limitar a taxa de
 * eventos WebSocket (move/restart) sem depender de timers — o refill é
 * calculado de forma preguiçosa a partir do tempo decorrido.
 */
export function createTokenBucket(opts: TokenBucketOptions): TokenBucket {
  const { capacity, refillPerSecond } = opts;
  const now = opts.now ?? Date.now;
  const states = new Map<string, BucketState>();

  return {
    tryRemove(key: string): boolean {
      const t = now();
      const state = states.get(key) ?? { tokens: capacity, last: t };
      const elapsedSec = (t - state.last) / 1000;
      state.tokens = Math.min(capacity, state.tokens + elapsedSec * refillPerSecond);
      state.last = t;
      if (state.tokens >= 1) {
        state.tokens -= 1;
        states.set(key, state);
        return true;
      }
      states.set(key, state);
      return false;
    },
    drop(key: string): void {
      states.delete(key);
    },
  };
}
