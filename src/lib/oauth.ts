import { requestHostPermission } from "./permissions";
import { setKey } from "../store/keys";

const AUTH_URL = "https://openrouter.ai/auth";
const EXCHANGE_URL = "https://openrouter.ai/api/v1/auth/keys";

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/**
 * OpenRouter's PKCE flow. The user approves in a browser tab and OpenRouter
 * mints a key on their own account, which lands here — nothing is copied by
 * hand, and the key remains theirs to inspect or revoke. Gloss still holds only
 * a key in local storage, so the no-server promise is untouched.
 *
 * Returns the key, already stored.
 */
export async function connectOpenRouter(origin: string): Promise<string> {
  // First, because permissions.request needs the click that started this and
  // waiting on the auth tab would spend it. The exchange below is a cross-origin
  // POST, so the grant is needed regardless.
  if (!(await requestHostPermission(origin))) {
    throw new Error("Gloss needs access to openrouter.ai to finish connecting.");
  }

  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const url =
    `${AUTH_URL}?callback_url=${encodeURIComponent(chrome.identity.getRedirectURL())}` +
    `&code_challenge=${await challengeFor(verifier)}` +
    `&code_challenge_method=S256&key_label=Gloss`;

  let redirect: string | undefined;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  } catch {
    // Closing the tab or declining lands here; it is not an error worth shouting about.
    throw new Error("Connection cancelled.");
  }

  const code = redirect ? new URL(redirect).searchParams.get("code") : null;
  if (!code) throw new Error("OpenRouter sent no authorization code back.");

  // The code is single-use and expires in ten minutes, so spend it immediately.
  const res = await fetch(EXCHANGE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
  });
  if (!res.ok) throw new Error(`OpenRouter refused the exchange (${res.status}).`);

  const key = ((await res.json()) as { key?: string }).key;
  if (!key) throw new Error("OpenRouter returned no key.");

  await setKey("openrouter", key);
  return key;
}
