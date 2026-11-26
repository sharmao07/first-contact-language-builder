"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, Plus, UserPlus } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/layout/site";
import { Field, Notice, PageHeader } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client/api";
import { writeIdentity } from "@/lib/client/identity";

export default function StartPage() {
  return (
    <>
      <SiteHeader />
      <main id="content" className="wrap page-pad stack-lg">
        <PageHeader
          eyebrow="Two-seat session setup"
          title="Open or join a discovery workspace"
          description="One person creates a session and shares a code like TREE-4821. The second person joins from their own browser so each seat keeps its own responses."
        />
        <div className="grid-2" style={{ alignItems: "start" }}>
          <CreateForm />
          <JoinForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function CreateForm() {
  const router = useRouter();
  const [name, setName] = useState("Field session");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"A" | "B">("A");
  const [purpose, setPurpose] = useState<"community" | "research" | "general">("community");
  const [communityRole, setCommunityRole] = useState<"facilitator" | "participant">("facilitator");
  const [consent, setConsent] = useState(false);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await api<{ code: string; token: string; participantId: string; role: string; displayName: string; purpose: string }>("/api/sessions", {
        body: { name, displayName, role, description, purpose, communityRole, consent },
      });
      writeIdentity({ ...result, code: result.code });
      router.push(result.purpose === "community" ? `/session/${result.code}/community` : `/session/${result.code}`);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "Could not create the session.");
      setPending(false);
    }
  }

  return (
    <form className="surface stack" onSubmit={submit}>
      <div className="row" style={{ gap: 10 }}>
        <Plus size={18} strokeWidth={1.5} style={{ color: "var(--oxide)" }} aria-hidden="true" />
        <div className="stack-xs">
          <h2>Start a session</h2>
          <p className="small">You will get a code like TREE-4821. The other person joins from their own browser.</p>
        </div>
      </div>

      <div className="purpose" role="radiogroup" aria-label="Session purpose">
        {([
          ["community", "Community access", "A newcomer and someone from the local community. This is the guided path."],
          ["research", "Language research", "Keep a field record with hypotheses, checks, and disagreements."],
          ["general", "General discovery", "Use the original discovery workspace without a guided situation."],
        ] as const).map(([value, title, copy]) => (
          <button key={value} type="button" className={purpose === value ? "btn is-selected" : "btn"} role="radio" aria-checked={purpose === value} onClick={() => setPurpose(value)}>
            <strong>{title}</strong>
            <small>{copy}</small>
          </button>
        ))}
      </div>

      <div className="grid-2">
        <Field label="Session name">
          <input className="control" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
        </Field>
        <Field label="Your name">
          <input className="control" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} placeholder="e.g. Ada" />
        </Field>
      </div>

      {purpose === "community" ? (
        <Field label="Your role" hint="This describes who guides the steps. It does not give either person authority over meaning.">
          <select className="select" value={communityRole} onChange={(event) => setCommunityRole(event.target.value as "facilitator" | "participant")}>
            <option value="facilitator">Community facilitator</option>
            <option value="participant">Participant</option>
          </select>
        </Field>
      ) : (
        <Field label="Your seat">
          <select className="select" value={role} onChange={(event) => setRole(event.target.value as "A" | "B")}>
            <option value="A">Participant A</option>
            <option value="B">Participant B</option>
          </select>
        </Field>
      )}

      {purpose === "community" ? (
        <label className="surface-recessed row" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} style={{ marginTop: 3 }} />
          <span className="small" style={{ color: "var(--ink)" }}>
            I understand this is shared discovery, not emergency or professional interpretation. Files stay with this session, and suggestions are not treated as verified meanings.
          </span>
        </label>
      ) : null}

      <Field label="Note" hint="Optional. Visible to both seats.">
        <textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
      </Field>

      <Button tone="primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Creating session…" : "Create session"}
        <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
      </Button>
      {message ? <Notice tone="error">{message}</Notice> : null}
    </form>
  );
}

function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("code");
    if (value) setCode(value.toUpperCase());
  }, []);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"A" | "B">("B");
  const [recovery, setRecovery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await api<{ code: string; token: string; participantId: string; role: string; displayName: string; purpose?: string }>("/api/sessions/join", {
        body: { code, displayName, role },
      });
      writeIdentity(result);
      router.push(result.purpose === "community" ? `/session/${result.code}/community` : `/session/${result.code}`);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "Could not join.");
      setPending(false);
    }
  }

  async function rejoin(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await api<{ code: string; token: string; participantId: string; role: string; displayName: string }>("/api/sessions/rejoin", {
        body: { code, token: recovery, displayName: displayName || undefined },
      });
      writeIdentity(result);
      router.push(`/session/${result.code}`);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "Could not rejoin.");
      setPending(false);
    }
  }

  return (
    <div className="stack">
      <form className="surface stack" onSubmit={join}>
        <div className="row" style={{ gap: 10 }}>
          <UserPlus size={18} strokeWidth={1.5} style={{ color: "var(--oxide)" }} aria-hidden="true" />
          <div className="stack-xs">
            <h2>Join with a code</h2>
            <p className="small">Enter the code shared by the other participant and take the open seat.</p>
          </div>
        </div>
        <Field label="Session code">
          <input className="control mono" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required placeholder="TREE-4821" />
        </Field>
        <div className="grid-2">
          <Field label="Your name">
            <input className="control" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} placeholder="e.g. Bao" />
          </Field>
          <Field label="Seat">
            <select className="select" value={role} onChange={(event) => setRole(event.target.value as "A" | "B")}>
              <option value="A">Participant A</option>
              <option value="B">Participant B</option>
            </select>
          </Field>
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Joining…" : "Join"}
        </button>
      </form>

      <details className="surface">
        <summary className="row" style={{ cursor: "pointer", fontWeight: 500 }}>
          <KeyRound size={16} strokeWidth={1.5} className="muted" aria-hidden="true" />
          Rejoin an existing seat with a recovery key
        </summary>
        <form className="stack" style={{ marginTop: 16 }} onSubmit={rejoin}>
          <p className="small">Use the session code from above and paste the 48-character recovery key saved from your previous browser.</p>
          <Field label="Recovery key">
            <input className="control mono" value={recovery} onChange={(event) => setRecovery(event.target.value)} required />
          </Field>
          <button className="btn" type="submit" disabled={pending}>Rejoin</button>
        </form>
      </details>

      {message ? <Notice tone="error">{message}</Notice> : null}
    </div>
  );
}
