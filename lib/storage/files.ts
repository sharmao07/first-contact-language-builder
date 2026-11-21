import fs from "fs/promises";
import path from "path";
import { HttpError } from "@/lib/http";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "audio/x-wav": "wav",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export function uploadsRoot() {
  return path.join(process.cwd(), "data", "uploads");
}

export function extensionFor(mimeType: string) {
  return MIME_EXT[mimeType.toLowerCase()] ?? null;
}

export function isSafeRelative(relative: string) {
  if (!relative || relative.includes("\0")) return false;
  if (path.isAbsolute(relative)) return false;
  const normalized = path.posix.normalize(relative.replace(/\\/g, "/"));
  return normalized !== ".." && !normalized.startsWith("../") && !normalized.includes("/../");
}

export function resolveUpload(relative: string) {
  if (!isSafeRelative(relative)) throw new HttpError(400, "Invalid file path.");
  const root = path.resolve(uploadsRoot());
  const full = path.resolve(root, relative);
  const comparison = path.relative(root, full);
  if (comparison.startsWith("..") || path.isAbsolute(comparison)) {
    throw new HttpError(400, "Invalid file path.");
  }
  return full;
}

export async function writeUpload(relative: string, bytes: Buffer) {
  const full = resolveUpload(relative);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, bytes);
  return full;
}

export async function readUpload(relative: string) {
  return fs.readFile(resolveUpload(relative));
}

export async function removeUpload(relative: string | null | undefined) {
  if (!relative) return;
  try {
    await fs.unlink(resolveUpload(relative));
  } catch {
    // The database row is the source of truth if the file is already gone.
  }
}

export async function removeUploadDir(sessionId: string) {
  if (!isSafeRelative(sessionId) || sessionId.includes("/")) return;
  const full = resolveUpload(sessionId);
  await fs.rm(full, { recursive: true, force: true });
}

export function sanitizeName(name: string) {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, "").slice(0, 80);
  return base || "upload";
}

export function inferMime(fileName: string, reported: string) {
  const mime = reported.toLowerCase().split(";")[0].trim();
  if (MIME_EXT[mime]) return mime;
  const ext = path.extname(fileName).toLowerCase();
  const fromExt: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
  };
  return fromExt[ext] ?? "";
}
