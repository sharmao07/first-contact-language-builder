import { HttpError } from "@/lib/http";
import { isSafeRelative } from "@/lib/storage/files";
import type { ObjectStore, StorageStatus } from "@/lib/storage/index";

type SupabaseConfig = {
  url: string;
  key: string;
  bucket: string;
};

function config(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "session-media";
  if (!url || !key || !bucket) return null;
  if (!url.startsWith("https://")) return null;
  return { url, key, bucket };
}

function objectPath(relative: string) {
  if (!isSafeRelative(relative)) throw new HttpError(400, "Invalid file path.");
  return relative.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function headers(key: string, extra?: Record<string, string>) {
  return {
    authorization: `Bearer ${key}`,
    apikey: key,
    ...extra,
  };
}

async function supabaseStatus(): Promise<StorageStatus> {
  const settings = config();
  if (!settings) {
    return {
      provider: "supabase",
      configured: false,
      persistent: false,
      detail: "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.",
    };
  }
  try {
    const response = await fetch(`${settings.url}/storage/v1/bucket/${encodeURIComponent(settings.bucket)}`, {
      headers: headers(settings.key),
      signal: AbortSignal.timeout(4000),
    });
    if (response.ok) {
      return {
        provider: "supabase",
        configured: true,
        persistent: true,
        detail: "Private Supabase Storage is configured.",
      };
    }
    if (response.status === 404) {
      return {
        provider: "supabase",
        configured: false,
        persistent: false,
        detail: "The Supabase bucket was not found. Create a private bucket named in SUPABASE_STORAGE_BUCKET.",
      };
    }
    return {
      provider: "supabase",
      configured: false,
      persistent: false,
      detail: "Supabase Storage rejected the server credentials.",
    };
  } catch {
    return {
      provider: "supabase",
      configured: false,
      persistent: false,
      detail: "Supabase Storage could not be reached.",
    };
  }
}

export const supabaseStore: ObjectStore = {
  async write(relative, bytes, contentType) {
    const settings = config();
    if (!settings) throw new HttpError(503, "Object storage is not configured.");
    const response = await fetch(`${settings.url}/storage/v1/object/${encodeURIComponent(settings.bucket)}/${objectPath(relative)}`, {
      method: "POST",
      headers: headers(settings.key, {
        "content-type": contentType || "application/octet-stream",
        "x-upsert": "true",
      }),
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new HttpError(503, "The file could not be stored.");
  },
  async read(relative) {
    const settings = config();
    if (!settings) throw new HttpError(503, "Object storage is not configured.");
    const response = await fetch(`${settings.url}/storage/v1/object/authenticated/${encodeURIComponent(settings.bucket)}/${objectPath(relative)}`, {
      headers: headers(settings.key),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new HttpError(404, "That file is not available.");
    return Buffer.from(await response.arrayBuffer());
  },
  async remove(relative) {
    if (!relative) return;
    const settings = config();
    if (!settings) return;
    await fetch(`${settings.url}/storage/v1/object/${encodeURIComponent(settings.bucket)}/${objectPath(relative)}`, {
      method: "DELETE",
      headers: headers(settings.key),
      signal: AbortSignal.timeout(20000),
    }).catch(() => undefined);
  },
  async removePrefix(prefix) {
    if (!isSafeRelative(prefix) || prefix.includes("/")) return;
    const settings = config();
    if (!settings) return;
    const listed = await fetch(`${settings.url}/storage/v1/object/list/${encodeURIComponent(settings.bucket)}`, {
      method: "POST",
      headers: headers(settings.key, { "content-type": "application/json" }),
      body: JSON.stringify({ prefix, limit: 1000 }),
      signal: AbortSignal.timeout(20000),
    });
    if (!listed.ok) return;
    const rows = (await listed.json()) as { name?: string }[];
    const prefixes = Array.isArray(rows) ? rows.map((row) => `${prefix}/${row.name ?? ""}`).filter((item) => item.endsWith("/") === false && item.length > prefix.length + 1) : [];
    if (!prefixes.length) return;
    await fetch(`${settings.url}/storage/v1/object/${encodeURIComponent(settings.bucket)}`, {
      method: "DELETE",
      headers: headers(settings.key, { "content-type": "application/json" }),
      body: JSON.stringify({ prefixes }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => undefined);
  },
  status: supabaseStatus,
};
