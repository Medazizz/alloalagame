// Appels au serveur du jeu + session du joueur (gardée sur le téléphone).
const BASE = `${import.meta.env.BASE_URL}api`;
const KEY = "aa-game-session";

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}
export function saveSession(sess) {
  try {
    if (sess) localStorage.setItem(KEY, JSON.stringify(sess));
    else localStorage.removeItem(KEY);
  } catch {
    // navigation privée : la session ne dure que le temps de la page
  }
}

export async function api(path, { method = "GET", body, token, headers = {} } = {}) {
  let r;
  try {
    r = await fetch(`${BASE}/${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Pas de connexion internet.");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || "Erreur, réessayez.");
    err.status = r.status;
    throw err;
  }
  return data;
}
