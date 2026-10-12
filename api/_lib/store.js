// Stockage : Upstash Redis en ligne (variables posées par Vercel),
// sinon une mémoire locale pour tester sur l'ordinateur.
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function memoryStore() {
  const kv = new Map(); // clé -> { v, exp }
  const z = new Map(); // clé -> Map(membre -> score)
  const alive = (k) => {
    const e = kv.get(k);
    if (e && e.exp && e.exp < Date.now()) kv.delete(k);
    return kv.get(k);
  };
  return {
    memory: true,
    async get(k) { return alive(k)?.v ?? null; },
    async set(k, v, opts = {}) {
      if (opts.nx && alive(k)) return null;
      kv.set(k, { v, exp: opts.ex ? Date.now() + opts.ex * 1000 : 0 });
      return "OK";
    },
    async del(k) { kv.delete(k); z.delete(k); return 1; },
    async incr(k) {
      const e = alive(k);
      const v = (e ? Number(e.v) : 0) + 1;
      kv.set(k, { v, exp: e?.exp || 0 });
      return v;
    },
    async expire(k, s) { const e = alive(k); if (e) e.exp = Date.now() + s * 1000; return 1; },
    async zaddGt(k, score, member) {
      if (!z.has(k)) z.set(k, new Map());
      const m = z.get(k);
      if (!m.has(member) || m.get(member) < score) m.set(member, score);
    },
    async zTop(k, n) {
      const m = z.get(k) || new Map();
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([member, score]) => ({ member, score }));
    },
    async zRankDesc(k, member) {
      const m = z.get(k) || new Map();
      if (!m.has(member)) return null;
      const s = m.get(member);
      return [...m.values()].filter((v) => v > s).length;
    },
    async zScore(k, member) { return z.get(k)?.get(member) ?? null; },
    async zCard(k) { return z.get(k)?.size || 0; },
  };
}

function redisStore() {
  const r = new Redis({ url, token });
  return {
    memory: false,
    get: (k) => r.get(k),
    set: (k, v, opts = {}) => r.set(k, v, opts),
    del: (k) => r.del(k),
    incr: (k) => r.incr(k),
    expire: (k, s) => r.expire(k, s),
    zaddGt: (k, score, member) => r.zadd(k, { gt: true }, { score, member }),
    async zTop(k, n) {
      const flat = await r.zrange(k, 0, n - 1, { rev: true, withScores: true });
      const out = [];
      for (let i = 0; i < flat.length; i += 2) out.push({ member: String(flat[i]), score: Number(flat[i + 1]) });
      return out;
    },
    zRankDesc: (k, member) => r.zrevrank(k, member),
    zScore: (k, member) => r.zscore(k, member),
    zCard: (k) => r.zcard(k),
  };
}

// En mémoire, on garde le même objet entre les appels (serveur de dev)
const g = globalThis;
export const store = url && token ? redisStore() : (g.__aaStore ||= memoryStore());
