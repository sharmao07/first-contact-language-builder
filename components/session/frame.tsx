"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, FlaskConical, LayoutGrid, PenLine, Rows3, ScrollText, Search, Settings, Users, Waypoints, FileText } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Field, Notice } from "@/components/ui/bits";
import { SessionProvider, useSessionContext } from "@/components/session/provider";
import { api, ApiError } from "@/lib/client/api";
import type { Identity } from "@/lib/types";

export function SessionFrame({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <SessionProvider code={code}>
      <FrameBody code={code}>{children}</FrameBody>
    </SessionProvider>
  );
}

function FrameBody({ code, children }: { code: string; children: React.ReactNode }) {
  const { state, loading, error, identity, syncMode } = useSessionContext();
  const pathname = usePathname();
  const community = state?.session.purpose === "community";
  const links = [
    [`/session/${code}/community`, "Community"],
    [`/session/${code}/experiments`, "Checks"],
    [`/session/${code}/board`, "Board"],
    ["/session/" + code, "Discovery"],
    [`/session/${code}/vocabulary`, "Vocabulary"],
    [`/session/${code}/learn`, "Practice"],
    [`/session/${code}/expressions`, "Expressions"],
    [`/session/${code}/graph`, "Graph"],
    [`/session/${code}/impact`, "Record"],
    [`/research/${code}`, "Research"],
    ["/settings", "Settings"],
  ];
  if (community) {
    const record = links.findIndex((item) => item[1] === "Record");
    const communityLink = links.findIndex((item) => item[1] === "Community");
    if (record > communityLink) {
      const [item] = links.splice(record, 1);
      links.splice(2, 0, item);
    }
  }

  const syncLabel = syncMode === "live" ? "Live with the other seat" : syncMode === "polling" ? "Refreshing the shared record" : "Connecting";

  return (
    <div className="shell">
      <header className="shell-top">
        <Link className="wordmark" href="/">
          <span className="reading-mark" aria-hidden="true" />
          First-Contact
        </Link>
        <span className="mono small">{state?.session.code ?? code}</span>
        <span className="live-dot" data-mode={syncMode} role="img" aria-label={syncLabel} />
        <span className="small muted">{syncLabel}</span>
        <span className="spacer" />
        <ThemeToggle />
      </header>
      <div className="shell-body">
        <nav className="shell-nav" aria-label="Session">
          {links.map(([href, label]) => {
            const Icon = NAV_ICON[label] ?? Search;
            return (
              <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} title={label}>
                <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="shell-main">
          {state?.session.status === "archived" ? (
            <div className="wrap" style={{ paddingTop: 16 }}>
              <Notice>This session is archived. The record is still here. Restore it from the discovery panel.</Notice>
            </div>
          ) : null}
          {state?.session.isIllustrative ? (
            <div className="wrap" style={{ paddingTop: 16 }}>
              <Notice>Illustrative sample. Not real linguistic research. Demo hypotheses were not produced by inspecting files.</Notice>
            </div>
          ) : null}
          {state?.ai.mode === "demo" ? (
            <div className="wrap" style={{ paddingTop: 16 }}>
              <Notice>{state.ai.disclosure}</Notice>
            </div>
          ) : null}
          <main id="content">
            {identity === undefined || (loading && !state) ? <SessionSkeleton /> : null}
            {error && !state ? (
              <div className="wrap section stack">
                <h1>Session unavailable</h1>
                <p>{error}</p>
                <Link className="btn" href="/start">Back to start</Link>
              </div>
            ) : null}
            {state && identity ? <SessionInvite code={code} /> : null}
            {state && identity === null ? <JoinPanel /> : null}
            {state && identity ? <div key={pathname} className="page-enter">{children}</div> : null}
          </main>
        </div>
      </div>
    </div>
  );
}

const NAV_ICON: Record<string, typeof Search> = {
  Community: Users,
  Checks: FlaskConical,
  Board: LayoutGrid,
  Discovery: Search,
  Vocabulary: BookOpen,
  Practice: PenLine,
  Expressions: Rows3,
  Graph: Waypoints,
  Record: ScrollText,
  Research: FileText,
  Settings,
};

function SessionSkeleton() {
  return (
    <div className="wrap section stack" aria-hidden="true">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}

function SessionInvite({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    const url = `${window.location.origin}/start?code=${code}`;
    let cancelled = false;
    void import("qrcode").then((qr) => qr.toString(url, { type: "svg", margin: 1, width: 132 })).then((markup) => {
      if (!cancelled) setSvg(markup);
    }).catch(() => setSvg(""));
    return () => { cancelled = true; };
  }, [code]);
  return (
    <div className="invite-strip">
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <p className="small">Invite the other person with this code or QR. They join from their own screen. Neither seat decides what an expression means.</p>
        {svg ? <div aria-label={`QR invitation for ${code}`} dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="mono">{code}</p>}
      </div>
    </div>
  );
}

function JoinPanel() {
  const { code, state, setIdentity } = useSessionContext();
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"A" | "B">("B");
  const [recovery, setRecovery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const taken = new Set((state?.participants ?? []).filter((person) => !person.leftAt).map((person) => person.role));

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await api<Identity & { code: string }>("/api/sessions/join", {
        body: { code, displayName, role },
      });
      setIdentity({ ...result, code });
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "Could not join.");
    } finally {
      setPending(false);
    }
  }

  async function rejoin(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await api<Identity>("/api/sessions/rejoin", {
        body: { code, token: recovery, displayName: displayName || undefined },
      });
      setIdentity({ ...result, code });
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "Could not rejoin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="wrap section grid-2">
      <form className="stack" onSubmit={join}>
        <h1>{state?.session.name}</h1>
        <p>{state?.session.purpose === "community" ? "Choose the open role. The facilitator guides the steps. Neither person decides what the other person's expression means." : "Choose an open seat. The other person uses the same session code on their own screen."}</p>
        <Field label="Your name">
          <input className="control" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} />
        </Field>
        <Field label="Seat">
          <select className="select" value={role} onChange={(event) => setRole(event.target.value as "A" | "B")}>
            <option value="A" disabled={taken.has("A")}>{state?.session.purpose === "community" ? "Community facilitator" : "Participant A"} {taken.has("A") ? "(taken)" : ""}</option>
            <option value="B" disabled={taken.has("B")}>{state?.session.purpose === "community" ? "Participant" : "Participant B"} {taken.has("B") ? "(taken)" : ""}</option>
          </select>
        </Field>
        <button className="btn btn-primary" type="submit" disabled={pending}>Join this session</button>
      </form>
      <form className="stack" onSubmit={rejoin}>
        <h2>Rejoin</h2>
        <p className="small">If this browser already joined, the recovery key is stored here. On a new browser, paste the key from the original seat.</p>
        <Field label="Recovery key">
          <input className="control mono" value={recovery} onChange={(event) => setRecovery(event.target.value)} required />
        </Field>
        <button className="btn" type="submit" disabled={pending}>Rejoin with recovery key</button>
        {message ? <Notice>{message}</Notice> : null}
        <p className="small muted">{state?.session.description}</p>
      </form>
    </div>
  );
}

export function LeaveButton() {
  const { code, identity, setIdentity } = useSessionContext();
  const router = useRouter();
  async function leave() {
    if (!identity) return;
    await api(`/api/sessions/${code}/leave`, { token: identity.token, body: {} });
    setIdentity(null);
    router.push("/");
  }
  return <button type="button" className="btn" onClick={() => void leave()}>Leave session</button>;
}
