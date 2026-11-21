import type { Identity } from "@/lib/types";

function key(code: string) {
  return `fclb:identity:${code.toUpperCase()}`;
}

export function readIdentity(code: string): Identity | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key(code));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Identity;
    if (!parsed.token || parsed.code?.toUpperCase() !== code.toUpperCase()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeIdentity(identity: Identity) {
  localStorage.setItem(key(identity.code), JSON.stringify({ ...identity, code: identity.code.toUpperCase() }));
}

export function clearIdentity(code: string) {
  localStorage.removeItem(key(code));
}
