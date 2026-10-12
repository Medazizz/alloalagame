import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

// En développement, sert les fonctions du dossier /api comme le fait Vercel
// (mode test : le code e-mail s'affiche à l'écran au lieu d'être envoyé).
function devApi() {
  return {
    name: "dev-api",
    configureServer(server) {
      process.env.DEV_MAIL ??= "1";
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        if (!url.pathname.startsWith("/api/")) return next();
        const file = path.join(process.cwd(), url.pathname + ".js");
        if (!fs.existsSync(file) || url.pathname.includes("/_lib/")) return next();
        let raw = "";
        for await (const chunk of req) raw += chunk;
        req.body = raw ? JSON.parse(raw) : {};
        const mod = await server.ssrLoadModule(file);
        try {
          await mod.default(req, res);
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Erreur serveur" }));
        }
      });
    },
  };
}

// Chemin du site : « / » en développement, « /jeu/ » sur le serveur (BASE_PATH dans .env)
function basePath() {
  let b = process.env.BASE_PATH;
  if (!b && fs.existsSync(".env")) b = (fs.readFileSync(".env", "utf8").match(/^\s*BASE_PATH\s*=\s*"?([^"\n]+)"?/m) || [])[1];
  b = (b || "/").trim();
  return ("/" + b.replace(/^\/+|\/+$/g, "") + "/").replace("//", "/");
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? basePath() : "/",
  plugins: [react(), devApi()],
}));
