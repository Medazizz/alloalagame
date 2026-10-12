// Stockage : Upstash Redis en ligne (variables posées par Vercel),
// sinon une mémoire locale pour tester sur l'ordinateur.
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function memoryStore() {
  const kv = new Map(); // clé -> { v, exp }
  const z = new Map(); // clé -> Map(membre -> score)
  const h = new Map(); // clé -> Map(champ -> valeur)
  const alive = (k) => {
    const e = kv.get(k);
    if (e && e.exp && e.exp < Date.now()) kv.delete(k);
    return kv.get(k);
  };
  const zs = (k) => (z.has(k) ? z.get(k) : z.set(k, new Map()).get(k));
  const hs = (k) => (h.has(k) ? h.get(k) : h.set(k, new Map()).get(k));
  return {
    memory: true,
    async get(k) { return alive(k)?.v ?? null; },
    async set(k, v, opts = {}) {
      if (opts.nx && alive(k)) return null;
      kv.set(k, { v, exp: opts.ex ? Date.now() + opts.ex * 1000 : 0 });
      return "OK";
    },
    async del(k) { kv.delete(k); z.delete(k); h.delete(k); return 1; },
    async incr(k) {
      const e = alive(k);
      const v = (e ? Number(e.v) : 0) + 1;
      kv.set(k, { v, exp: e?.exp || 0 });
      return v;
    },
    async expire(k, s) { const e = alive(k); if (e) e.exp = Date.now() + s * 1000; return 1; },
    async zset(k, score, member) { zs(k).set(member, score); },
    async zTop(k, n) {
      return [...zs(k).entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([member, score]) => ({ member, score }));
    },
    async zRankDesc(k, member) {
      const m = zs(k);
      if (!m.has(member)) return null;
      const s = m.get(member);
      return [...m.values()].filter((v) => v > s).length;
    },
    async zScore(k, member) { return zs(k).get(member) ?? null; },
    async zCard(k) { return zs(k).size; },
    async hget(k, f) { return hs(k).get(f) ?? null; },
    async hset(k, obj) { for (const [f, v] of Object.entries(obj)) hs(k).set(f, v); },
    async hgetall(k) { return h.has(k) ? Object.fromEntries(h.get(k)) : null; },
    async hincrby(k, f, n) { const m = hs(k); m.set(f, Number(m.get(f) || 0) + n); return m.get(f); },
  };
}

function redisStore() {
  // valeurs brutes (texte) : pas de conversion automatique surprise
  const r = new Redis({ url, token, automaticDeserialization: false });
  return {
    memory: false,
    get: (k) => r.get(k),
    set: (k, v, opts = {}) => r.set(k, v, opts),
    del: (k) => r.del(k),
    incr: (k) => r.incr(k),
    expire: (k, s) => r.expire(k, s),
    zset: (k, score, member) => r.zadd(k, { score, member }),
    async zTop(k, n) {
      const flat = await r.zrange(k, 0, n - 1, { rev: true, withScores: true });
      const out = [];
      for (let i = 0; i < flat.length; i += 2) out.push({ member: String(flat[i]), score: Number(flat[i + 1]) });
      return out;
    },
    zRankDesc: (k, member) => r.zrevrank(k, member),
    zScore: (k, member) => r.zscore(k, member),
    zCard: (k) => r.zcard(k),
    hget: (k, f) => r.hget(k, f),
    hset: (k, obj) => r.hset(k, obj),
    hgetall: (k) => r.hgetall(k),
    hincrby: (k, f, n) => r.hincrby(k, f, n),
  };
}

export const storeConfigured = Boolean(url && token);
// En ligne (Vercel), la base de données est obligatoire : sans elle, les données
// seraient perdues. On refuse donc de démarrer en mémoire.
const online = Boolean(process.env.VERCEL);

function missingStore() {
  const fail = async () => {
    throw Object.assign(new Error("Base de données non configurée (Upstash Redis)."), { status: 503 });
  };
  return new Proxy({}, { get: (_, prop) => (prop === "memory" ? false : fail) });
}

// En mémoire, on garde le même objet entre les appels (serveur de dev)
const g = globalThis;
export const store = storeConfigured ? redisStore() : online ? missingStore() : (g.__aaStore ||= memoryStore());
