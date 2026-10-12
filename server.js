// Serveur Allo..Ala Jeux pour le VPS (Node.js 18+, aucune autre installation).
// Sert le site (dossier dist/) et l'API (dossier api/) sous BASE_PATH, ex. /jeu/.
// nginx transmet https://alloala.com/jeu/ vers ce serveur (voir deploy/nginx.conf).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// --- réglages : fichier .env (KEY=valeur), sans dépendance ---
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
process.env.DATA_DIR ||= path.join(ROOT, "data");
const BASE = ("/" + (process.env.BASE_PATH || "/jeu/").replace(/^\/+|\/+$/g, "") + "/").replace("//", "/");
const PORT = Number(process.env.PORT || 3010);
const HOST = process.env.HOST || "127.0.0.1";
const DIST = path.join(ROOT, "dist");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

function security(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

const handlers = new Map();
async function apiHandler(name) {
  if (!/^[a-z0-9/_-]+$/i.test(name) || name.includes("_lib") || name.includes("..")) return null;
  const file = path.join(ROOT, "api", name + ".js");
  if (!fs.existsSync(file)) return null;
  if (!handlers.has(name)) handlers.set(name, (await import(pathToFileURL(file).href)).default);
  return handlers.get(name);
}

function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0, raw = "";
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error("too large"), { status: 413 })); req.destroy(); }
      else raw += c;
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

function sendFile(res, file, cache) {
  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": cache });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  security(res);
  const url = new URL(req.url, "http://local");
  let p = decodeURIComponent(url.pathname);

  if (p === BASE.slice(0, -1)) { res.writeHead(301, { Location: BASE + url.search }); return res.end(); }
  if (!p.startsWith(BASE)) { res.writeHead(404); return res.end("Not found"); }
  const rel = p.slice(BASE.length);

  // ---- API ----
  if (rel.startsWith("api/")) {
    try {
      const fn = await apiHandler(rel.slice(4).replace(/\/$/, ""));
      if (!fn) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end('{"error":"Introuvable"}'); }
      req.body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : {};
      await fn(req, res);
    } catch (e) {
      console.error(new Date().toISOString(), rel, e);
      if (!res.headersSent) res.writeHead(e.status || 500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: e.status === 413 ? "Requête trop grande." : "Erreur serveur, réessayez." }));
    }
    return;
  }

  // ---- fichiers du site ----
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (rel && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const immutable = rel.startsWith("assets/");
    return sendFile(res, file, immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600");
  }
  // toute autre adresse : la page de l'application
  return sendFile(res, path.join(DIST, "index.html"), "no-cache");
});

server.listen(PORT, HOST, () => {
  console.log(`Allo..Ala Jeux : http://${HOST}:${PORT}${BASE}  (données : ${process.env.DATA_DIR})`);
});
