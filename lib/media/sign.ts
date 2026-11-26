import crypto from "node:crypto";
import { isHostedDeployment } from "@/lib/storage";

const LOCAL_KEY = "local-development-only-media-key";
const DEFAULT_TTL_SECONDS = 15 * 60;

export function mediaTtlSeconds() {
  const raw = Number(process.env.MEDIA_URL_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(raw)) return DEFAULT_TTL_SECONDS;
  return Math.min(60 * 60, Math.max(60, Math.floor(raw)));
}

export function mediaKey() {
  const secret = process.env.MEDIA_SIGNING_SECRET?.trim() ?? "";
  if (secret.length >= 16) return secret;
  if (isHostedDeployment()) return null;
  return LOCAL_KEY;
}

export function mediaSigningStatus() {
  const secret = process.env.MEDIA_SIGNING_SECRET?.trim() ?? "";
  if (secret.length >= 16) {
    return { configured: true, detail: "Media URLs are signed on the server and expire." };
  }
  if (mediaKey() === LOCAL_KEY) {
    return {
      configured: true,
      detail: "Local development signs media with a built-in key. Set MEDIA_SIGNING_SECRET before a shared deployment.",
    };
  }
  return { configured: false, detail: "Set MEDIA_SIGNING_SECRET to at least 16 characters." };
}

export function signMediaPath(id: string, now = Date.now()) {
  const key = mediaKey();
  if (!key) return null;
  const exp = Math.floor(now / 1000) + mediaTtlSeconds();
  const sig = crypto.createHmac("sha256", key).update(`${id}.${exp}`).digest("base64url");
  return `/api/media/${encodeURIComponent(id)}?exp=${exp}&sig=${sig}`;
}

export function mediaSignatureValid(id: string, exp: string | null, sig: string | null, now = Date.now()) {
  const key = mediaKey();
  if (!key || !exp || !sig || !/^\d{1,12}$/.test(exp)) return false;
  const expiresAt = Number(exp) * 1000;
  if (expiresAt < now - 30_000) return false;
  if (expiresAt > now + mediaTtlSeconds() * 1000 + 30_000) return false;
  const expected = crypto.createHmac("sha256", key).update(`${id}.${exp}`).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
