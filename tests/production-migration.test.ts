import { afterEach, describe, expect, it } from "vitest";
import { mediaSignatureValid, signMediaPath } from "@/lib/media/sign";
import { syncTransport } from "@/lib/sync/transport";
import { TABLES } from "../scripts/copy-sqlite-to-postgres.mjs";

const original = {
  secret: process.env.MEDIA_SIGNING_SECRET,
  vercel: process.env.VERCEL,
  sync: process.env.SYNC_TRANSPORT,
  database: process.env.DATABASE_URL,
};

afterEach(() => {
  process.env.MEDIA_SIGNING_SECRET = original.secret;
  process.env.VERCEL = original.vercel;
  process.env.SYNC_TRANSPORT = original.sync;
  process.env.DATABASE_URL = original.database;
});

describe("media signatures", () => {
  it("accepts a fresh signature and rejects a session code", () => {
    process.env.MEDIA_SIGNING_SECRET = "test-signing-secret-value";
    delete process.env.VERCEL;
    const path = signMediaPath("evidence-1", 1_700_000_000_000);
    expect(path).toContain("sig=");
    const url = new URL(path ?? "", "http://local");
    expect(mediaSignatureValid("evidence-1", url.searchParams.get("exp"), url.searchParams.get("sig"), 1_700_000_000_000)).toBe(true);
    expect(mediaSignatureValid("evidence-1", url.searchParams.get("exp"), "not-the-signature", 1_700_000_000_000)).toBe(false);
  });

  it("rejects an expired signature", () => {
    process.env.MEDIA_SIGNING_SECRET = "test-signing-secret-value";
    const path = signMediaPath("evidence-1", 1_700_000_000_000);
    const url = new URL(path ?? "", "http://local");
    const later = 1_700_000_000_000 + 7 * 60 * 60 * 1000;
    expect(mediaSignatureValid("evidence-1", url.searchParams.get("exp"), url.searchParams.get("sig"), later)).toBe(false);
  });
});

describe("production sync", () => {
  it("uses polling on Vercel and the stream on a local server", () => {
    delete process.env.SYNC_TRANSPORT;
    process.env.VERCEL = "1";
    expect(syncTransport()).toBe("poll");
    delete process.env.VERCEL;
    expect(syncTransport()).toBe("stream");
  });
});

describe("record copy", () => {
  it("includes the community tables and the original session tables", () => {
    expect(TABLES).toContain("DiscoverySession");
    expect(TABLES).toContain("CommunicationTask");
    expect(TABLES).toContain("IndependentResponse");
    expect(TABLES).toContain("ExperimentProposal");
    expect(TABLES.indexOf("CommunicationTask")).toBeLessThan(TABLES.indexOf("IndependentResponse"));
  });
});
