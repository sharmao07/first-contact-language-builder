"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { clearIdentity, readIdentity, writeIdentity } from "@/lib/client/identity";
import type { Identity, ParticipantDTO, SessionState } from "@/lib/types";

type SyncResponse = {
  revision: number;
  state: SessionState | null;
  presence: ParticipantDTO[];
  mediaUrls?: Record<string, string>;
  transport?: "stream" | "poll";
};

type SessionApi = {
  code: string;
  state: SessionState | null;
  loading: boolean;
  error: string | null;
  identity: Identity | null | undefined;
  syncMode: "connecting" | "live" | "polling";
  setIdentity: (identity: Identity | null) => void;
  reload: () => void;
};

const SessionContext = createContext<SessionApi | null>(null);

export function useSessionContext() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session tools are only available inside a session.");
  return value;
}

export function SessionProvider({ code, children }: { code: string; children: React.ReactNode }) {
  const [state, setState] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentityState] = useState<Identity | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const [syncMode, setSyncMode] = useState<SessionApi["syncMode"]>("connecting");
  const revisionRef = useRef(0);

  useEffect(() => {
    setIdentityState(readIdentity(code));
    revisionRef.current = 0;
    setState(null);
  }, [code]);

  useEffect(() => {
    if (identity === undefined) return;
    let stop = false;
    let pollTimer = 0;
    let reconnectTimer = 0;
    const abort = new AbortController();

    async function pull() {
      try {
        const data = await api<SyncResponse>(`/api/sessions/${code}/sync?revision=${revisionRef.current}`, {
          token: identity?.token,
        });
        if (stop) return null;
        apply(data);
        setError(null);
        return data;
      } catch (caught) {
        if (!stop) setError(caught instanceof ApiError ? caught.message : "The session could not be loaded.");
        return null;
      } finally {
        if (!stop) setLoading(false);
      }
    }

    function apply(data: SyncResponse) {
      if (data.state) {
        revisionRef.current = data.state.session.revision;
        setState(data.state);
        return;
      }
      setState((current) => {
        if (!current) return current;
        const evidence = data.mediaUrls
          ? current.evidence.map((item) => (data.mediaUrls?.[item.id] ? { ...item, mediaUrl: data.mediaUrls[item.id] } : item))
          : current.evidence;
        return { ...current, evidence, participants: data.presence ?? current.participants };
      });
    }

    async function listen() {
      const first = await pull();
      if (stop) return;
      if (!identity?.token || first?.transport === "poll") {
        setSyncMode("polling");
        pollTimer = window.setInterval(() => void pull(), 2500);
        return;
      }
      try {
        const response = await fetch(`/api/sessions/${code}/stream?revision=${revisionRef.current}`, {
          headers: { "x-participant-token": identity.token },
          signal: abort.signal,
        });
        if (!response.ok || !response.body) throw new Error("stream");
        if ((response.headers.get("content-type") ?? "").includes("application/json")) {
          const body = await response.json() as SyncResponse;
          if (body.transport !== "poll") throw new Error("stream");
          setSyncMode("polling");
          pollTimer = window.setInterval(() => void pull(), 2500);
          return;
        }
        setSyncMode("live");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!stop) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            if (part.startsWith("event: error")) {
              throw new Error("stream");
            }
            const line = part.split("\n").find((item) => item.startsWith("data:"));
            if (!line) continue;
            apply(JSON.parse(line.slice(5).trim()) as SyncResponse);
          }
        }
        if (!stop) throw new Error("stream ended");
      } catch {
        if (stop) return;
        setSyncMode("polling");
        await pull();
        pollTimer = window.setInterval(() => void pull(), 2500);
        reconnectTimer = window.setTimeout(() => {
          window.clearInterval(pollTimer);
          void listen();
        }, 8000);
      }
    }

    setLoading(true);
    void listen();
    return () => {
      stop = true;
      abort.abort();
      window.clearInterval(pollTimer);
      window.clearTimeout(reconnectTimer);
    };
  }, [code, identity, tick]);

  function setIdentity(next: Identity | null) {
    if (next) writeIdentity(next);
    else clearIdentity(code);
    revisionRef.current = 0;
    setIdentityState(next);
  }

  function reload() {
    revisionRef.current = 0;
    setTick((value) => value + 1);
  }

  return (
    <SessionContext.Provider value={{ code, state, loading, error, identity, syncMode, setIdentity, reload }}>
      {children}
    </SessionContext.Provider>
  );
}
