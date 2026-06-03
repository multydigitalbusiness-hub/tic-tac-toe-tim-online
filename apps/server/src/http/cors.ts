export type OriginCallback = (err: Error | null, allow: boolean) => void;
export type CorsOriginFn = (origin: string | undefined, cb: OriginCallback) => void;

/** Escapa metacaracteres de regex, exceto o `*` (tratado como curinga). */
function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Constrói um matcher de origem para @fastify/cors e socket.io a partir de uma
 * lista de origens permitidas. Suporta curinga `*` (ex.: previews da Vercel),
 * onde `*` casa um único rótulo de subdomínio (sem atravessar pontos).
 *
 * Requisições sem header Origin (curl, same-origin) são permitidas.
 */
export function buildCorsOrigin(origins: string[]): CorsOriginFn {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];

  for (const o of origins) {
    if (o.includes("*")) {
      // `*` casa um rótulo: qualquer caractere exceto ponto, barra ou espaço.
      const re = "^" + escapeForRegex(o).replace(/\\\*/g, "[^./\\s]+") + "$";
      patterns.push(new RegExp(re));
    } else {
      exact.add(o);
    }
  }

  return (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }
    if (exact.has(origin)) {
      cb(null, true);
      return;
    }
    for (const re of patterns) {
      if (re.test(origin)) {
        cb(null, true);
        return;
      }
    }
    cb(null, false);
  };
}
