"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  FileText,
  FlaskConical,
  LayoutGrid,
  LogOut,
  PenLine,
  QrCode,
  Rows3,
  ScrollText,
  Search,
  Settings,
  Users,
  Waypoints,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CopyCodeButton, Field, Notice } from "@/components/ui/bits";
import { MotionReveal } from "@/components/ui/motion";
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const community = state?.session.purpose === "community";

  const workflowLinks: Array<[string, string]> = community
    ? [
        [`/session/${code}/community`, "Community"],
        [`/session/${code}/experiments`, "Checks"],
        [`/session/${code}/impact`, "Record"],
        [`/session/${code}/board`, "Board"],
        [`/session/${code}`, "Discovery"],
      ]
    : [
        [`/session/${code}`, "Discovery"],
        [`/session/${code}/experiments`, "Checks"],
        [`/session/${code}/community`, "Community"],
        [`/session/${code}/board`, "Board"],
        [`/session/${code}/impact`, "Record"],
      ];

  const corpusLinks: Array<[string, string]> = [
    [`/session/${code}/vocabulary`, "Vocabulary"],
    [`/session/${code}/learn`, "Practice"],
    [`/session/${code}/expressions`, "Expressions"],
    [`/session/${code}/graph`, "Graph"],
    [`/research/${code}`, "Research"],
    ["/settings", "Settings"],
  ];

  const syncLabel =
    syncMode === "live"
      ? "Live with the other seat"
      : syncMode === "polling"
        ? "Refreshing the shared record"
        : "Connecting";

  return (
    <div className="shell">
      <header className="shell-top">
        <Link className="wordmark" href="/">
          <span className="reading-mark" aria-hidden="true" />
          First-Contact
        </Link>

        <CopyCodeButton code={state?.session.code ?? code} compact />

        <div className="sync-pill" title={syncLabel}>
          <span className="live-dot" data-mode={syncMode} role="img" aria-label={syncLabel} />
          <span className="sync-label-text">{syncLabel}</span>
        </div>

        <span className="spacer" />

        {identity ? (
          <span className="session-pill small" title="Your current seat">
            <span className="seat-mark" data-state="here" aria-hidden="true" />
            <span>{identity.displayName}</span>
            <span className="mono muted">{identity.role}</span>
          </span>
        ) : null}

        {state && identity ? (
          <div className="popover-wrap">
            <button
              type="button"
              className={inviteOpen ? "btn btn-sm is-selected" : "btn btn-sm"}
              aria-expanded={inviteOpen}
              aria-label="Invite participant with code or QR"
              onClick={() => setInviteOpen((open) => !open)}
            >
              <QrCode size={15} strokeWidth={1.5} aria-hidden="true" />
              <span className="invite-label">Invite</span>
            </button>
            {inviteOpen ? <InvitePopover code={code} onClose={() => setInviteOpen(false)} /> : null}
          </div>
        ) : null}

        <ThemeToggle />
      </header>

      <div className="shell-body">
        <nav className="shell-nav" aria-label="Session">
          <div className="nav-group">
            <span className="nav-group-label">Workflow</span>
            {workflowLinks.map(([href, label]) => {
              const Icon = NAV_ICON[label] ?? Search;
              return (
                <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} title={label}>
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
          <div className="nav-group">
            <span className="nav-group-label">Corpus & analysis</span>
            {corpusLinks.map(([href, label]) => {
              const Icon = NAV_ICON[label] ?? Search;
              return (
                <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} title={label}>
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="shell-main">
          {state && (state.session.status === "archived" || state.session.isIllustrative || state.ai.mode === "demo") ? (
            <div className="shell-banners">
              {state.session.status === "archived" ? (
                <Notice tone="warning">This session is archived. The record is still here. Restore it from the discovery panel.</Notice>
              ) : null}
              {state.session.isIllustrative ? (
                <Notice tone="warning">Illustrative sample. Not real linguistic research. Demo hypotheses were not produced by inspecting files.</Notice>
              ) : null}
              {state.ai.mode === "demo" ? (
                <Notice>{state.ai.disclosure}</Notice>
              ) : null}
            </div>
          ) : null}

          <main id="content" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {identity === undefined || (loading && !state) ? <SessionSkeleton /> : null}
            {error && !state ? (
              <div className="wrap-narrow page-pad">
                <div className="surface stack">
                  <h1>Session unavailable</h1>
                  <p className="small">{error}</p>
                  <div>
                    <Link className="btn btn-primary" href="/start">Back to start</Link>
                  </div>
                </div>
              </div>
            ) : null}
            {state && identity === null ? <JoinPanel /> : null}
            {state && identity ? (
              <MotionReveal key={pathname} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {children}
              </MotionReveal>
            ) : null}
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
    <div className="wrap page-pad stack" aria-hidden="true">
      <div className="surface stack">
        <div className="skeleton" style={{ width: "35%" }} />
        <div className="skeleton" style={{ width: "70%" }} />
        <div className="skeleton" style={{ width: "55%" }} />
      </div>
    </div>
  );
}

function InvitePopover({ code, onClose }: { code: string; onClose: () => void }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    const url = `${window.location.origin}/start?code=${code}`;
    let cancelled = false;
    void import("qrcode")
      .then((qr) => qr.toString(url, { type: "svg", margin: 1, width: 164 }))
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => setSvg(""));
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="popover-panel stack" role="dialog" aria-label="Session invitation">
      <div className="row-between">
        <h3>Invite the other seat</h3>
        <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close invitation">
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <p className="small">
        Share this code or QR. They join from their own browser. Neither seat decides what an expression means.
      </p>
      <div className="row-between surface-recessed" style={{ padding: 12 }}>
        <span className="share-code mono">{code}</span>
        <CopyCodeButton code={code} />
      </div>
      {svg ? (
        <div
          aria-label={`QR invitation for ${code}`}
          style={{ display: "grid", placeItems: "center", background: "#ffffff", padding: 12, borderRadius: "var(--radius)" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
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
    <div className="wrap page-pad grid-2" style={{ alignItems: "start" }}>
      <form className="surface stack" onSubmit={join}>
        <p className="eyebrow">Open seat · {code}</p>
        <h1>{state?.session.name}</h1>
        <p className="small">
          {state?.session.purpose === "community"
            ? "Choose the open role. The facilitator guides the steps. Neither person decides what the other person's expression means."
            : "Choose an open seat. The other person uses the same session code on their own screen."}
        </p>
        <Field label="Your name">
          <input className="control" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} />
        </Field>
        <Field label="Seat">
          <select className="select" value={role} onChange={(event) => setRole(event.target.value as "A" | "B")}>
            <option value="A" disabled={taken.has("A")}>
              {state?.session.purpose === "community" ? "Community facilitator" : "Participant A"} {taken.has("A") ? "(taken)" : ""}
            </option>
            <option value="B" disabled={taken.has("B")}>
              {state?.session.purpose === "community" ? "Participant" : "Participant B"} {taken.has("B") ? "(taken)" : ""}
            </option>
          </select>
        </Field>
        <button className="btn btn-primary" type="submit" disabled={pending}>Join this session</button>
      </form>

      <form className="surface stack" onSubmit={rejoin}>
        <h2>Rejoin</h2>
        <p className="small">
          If this browser already joined, the recovery key is stored here. On a new browser, paste the key from the original seat.
        </p>
        <Field label="Recovery key">
          <input className="control mono" value={recovery} onChange={(event) => setRecovery(event.target.value)} required />
        </Field>
        <button className="btn" type="submit" disabled={pending}>Rejoin with recovery key</button>
        {message ? <Notice tone="error">{message}</Notice> : null}
        {state?.session.description ? <p className="small muted">{state.session.description}</p> : null}
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
  return (
    <button type="button" className="btn btn-sm" onClick={() => void leave()}>
      <LogOut size={14} strokeWidth={1.5} aria-hidden="true" />
      Leave session
    </button>
  );
}
