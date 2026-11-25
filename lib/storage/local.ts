import fs from "fs/promises";
import { readUpload as readLocal, removeUpload as removeLocal, removeUploadDir, uploadsRoot, writeUpload as writeLocal } from "@/lib/storage/files";
import type { ObjectStore, StorageStatus } from "@/lib/storage/index";

async function localStatus(): Promise<StorageStatus> {
  try {
    await fs.mkdir(uploadsRoot(), { recursive: true });
    await fs.access(uploadsRoot());
    return {
      provider: "local",
      configured: true,
      available: true,
      persistent: true,
      detail: "Uploads stay in data/uploads on this machine.",
    };
  } catch {
    return {
      provider: "local",
      configured: true,
      available: false,
      persistent: false,
      detail: "The local upload directory is not writable.",
    };
  }
}

export const localStore: ObjectStore = {
  async write(relative, bytes) {
    await writeLocal(relative, bytes);
  },
  async read(relative) {
    return readLocal(relative);
  },
  async remove(relative) {
    await removeLocal(relative);
  },
  async removePrefix(prefix) {
    await removeUploadDir(prefix);
  },
  status: localStatus,
};
