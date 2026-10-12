// Stockage des données du jeu.
//   - Sur votre serveur (VPS) : un fichier de données (DATA_DIR/db.json), enregistré
//     automatiquement après chaque changement + une copie de sauvegarde par jour.
//   - Sur Vercel : Upstash Redis (variables KV_REST_API_URL / KV_REST_API_TOKEN).
//   - En développement : en mémoire.
import fs from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function memoryStore(initial = null, onChange = () => {}) {
  const kv = new Map(initial?.kv || []); // clé -> { v, exp }
  const z = new Map((initial?.z || []).map(([k, e]) => [k, new Map(e)])); // clé -> Map(membre -> score)
  const h = new Map((initial?.h || []).map(([k, e]) => [k, new Map(e)])); // clé -> Map(champ -> valeur)
  const alive = (k) => {
    const e = kv.get(k);
    if (e && e.exp && e.exp < Date.now()) kv.delete(k);
    return kv.get(k);
  };
  const zs = (k) => (z.has(k) ? z.get(k) : z.set(k, new Map()).get(k));
  const hs = (k) => (h.has(k) ? h.get(k) : h.set(k, new Map()).get(k));
  const api = {
    memory: true,
    dump() {
      const now = Date.now();
      return {
        kv: [...kv.entries()].filter(([, e]) => !e.exp || e.exp > now),
        z: [...z.entries()].map(([k, m]) => [k, [...m.entries()]]),
        h: [...h.entries()].map(([k, m]) => [k, [...m.entries()]]),
      };
    },
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
  // toute écriture déclenche l'enregistrement
  for (const name of ["set", "del", "incr", "expire", "zset", "hset", "hincrby"]) {
    const fn = api[name];
    api[name] = async (...args) => {
      const r = await fn(...args);
      onChange();
      return r;
    };
  }
  return api;
}

// Base de données fichier pour le VPS : écriture atomique (fichier temporaire puis
// renommage), regroupée toutes les 300 ms, et sauvegarde quotidienne gardée 14 jours.
function fileStore(dir) {
  fs.mkdirSync(path.join(dir, "backups"), { recursive: true });
  const file = path.join(dir, "db.json");
  let initial = null;
  if (fs.existsSync(file)) initial = JSON.parse(fs.readFileSync(file, "utf8"));
  let timer = null;
  let st;
  const save = () => {
    timer = null;
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(st.dump()));
    fs.renameSync(tmp, file);
    const day = new Date().toISOString().slice(0, 10);
    const backup = path.join(dir, "backups", `db-${day}.json`);
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(file, backup);
      const old = fs.readdirSync(path.join(dir, "backups")).filter((f) => f.startsWith("db-")).sort().slice(0, -14);
      for (const f of old) fs.unlinkSync(path.join(dir, "backups", f));
    }
  };
  st = memoryStore(initial, () => { if (!timer) timer = setTimeout(save, 300); });
  st.memory = false;
  st.flush = () => { if (timer) { clearTimeout(timer); save(); } };
  process.once("SIGTERM", () => { st.flush(); process.exit(0); });
  process.once("SIGINT", () => { st.flush(); process.exit(0); });
  return st;
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

const dataDir = process.env.DATA_DIR;
export const storeConfigured = Boolean((url && token) || dataDir);
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
export const store = url && token
  ? redisStore()
  : dataDir
    ? (g.__aaStore ||= fileStore(dataDir))
    : online
      ? missingStore()
      : (g.__aaStore ||= memoryStore());
