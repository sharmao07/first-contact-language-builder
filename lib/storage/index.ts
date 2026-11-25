import { HttpError } from "@/lib/http";
import { localStore } from "@/lib/storage/local";
import { supabaseStore } from "@/lib/storage/supabase";

export type StorageProviderName = "local" | "supabase";

export type StorageStatus = {
  provider: StorageProviderName;
  configured: boolean;
  available: boolean;
  persistent: boolean;
  detail: string;
};

export type ObjectStore = {
  write(relative: string, bytes: Buffer, contentType?: string): Promise<void>;
  read(relative: string): Promise<Buffer>;
  remove(relative: string | null | undefined): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
  status(): Promise<StorageStatus>;
};

export function storageProviderName(): StorageProviderName {
  const value = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  if (value === "supabase") return "supabase";
  return "local";
}

export function databaseKind() {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "postgresql";
  if (url.startsWith("file:")) return "sqlite";
  return "unknown";
}

export function getObjectStore(): ObjectStore {
  const provider = storageProviderName();
  const production = process.env.VERCEL === "1" || databaseKind() === "postgresql";
  if (production && provider !== "supabase") {
    throw new HttpError(503, "Production storage is not configured. Local disk is not used as a fallback.");
  }
  return provider === "supabase" ? supabaseStore : localStore;
}

export async function storageStatus(): Promise<StorageStatus> {
  const provider = storageProviderName();
  const production = process.env.VERCEL === "1" || databaseKind() === "postgresql";
  if (production && provider !== "supabase") {
    return {
      provider,
      configured: false,
      available: false,
      persistent: false,
      detail: "A production deployment cannot keep uploads on local disk. Set STORAGE_PROVIDER=supabase.",
    };
  }
  return getObjectStore().status();
}

export async function writeUpload(relative: string, bytes: Buffer, contentType?: string) {
  try {
    await getObjectStore().write(relative, bytes, contentType);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "The file could not be stored.");
  }
}

export async function readUpload(relative: string) {
  try {
    return await getObjectStore().read(relative);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(404, "That file is not available.");
  }
}

export async function removeUpload(relative: string | null | undefined) {
  await getObjectStore().remove(relative);
}

export async function removeUploadDir(prefix: string) {
  await getObjectStore().removePrefix(prefix);
}
