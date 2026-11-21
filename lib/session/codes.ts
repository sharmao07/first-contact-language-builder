import { randomBytes, randomInt } from "crypto";

const WORDS = [
  "TREE",
  "RIVER",
  "STONE",
  "BIRD",
  "MOON",
  "LEAF",
  "FIRE",
  "WIND",
  "SEED",
  "WAVE",
  "STAR",
  "PATH",
  "CLOUD",
  "SHORE",
  "FIELD",
  "CEDAR",
  "MARSH",
  "RIDGE",
  "BROOK",
  "FLINT",
];

export function generateSessionCode() {
  const word = WORDS[randomInt(WORDS.length)];
  const num = randomInt(1000, 10000);
  return `${word}-${num}`;
}

export function isSessionCode(value: string) {
  return /^[A-Z]{3,12}-\d{4}$/.test(value);
}

export function createToken() {
  return randomBytes(24).toString("hex");
}

export function nextConceptCode(existing: string[]) {
  const nums = existing
    .map((code) => Number(code.replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `C-${String(next).padStart(3, "0")}`;
}

export function assertSameSession(recordSessionId: string, sessionId: string) {
  if (recordSessionId !== sessionId) {
    throw new Error("Session isolation check failed.");
  }
}
