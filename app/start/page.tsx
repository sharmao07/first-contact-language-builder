"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/site";
import { Field, Notice } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client/api";
import { writeIdentity } from "@/lib/client/identity";

export default function StartPage() {
  return (
    <>
      <SiteHeader />
      <main id="content" className="wrap section grid-2">
        <CreateForm />
        <JoinForm />
      </main>
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
    <form className="stack" onSubmit={submit}>
      <h1>Start a session</h1>
      <p>You will get a code like TREE-4821. The other person joins from their own browser.</p>
      <div className="purpose" role="radiogroup" aria-label="Session purpose">
        {([
          ["community", "Community access", "A newcomer and someone from the local community. This is the guided path."],
          ["research", "Language research", "Keep a field record with hypotheses, checks, and disagreements."],
          ["general", "General discovery", "Use the original discovery workspace without a guided situation."],
        ] as const).map(([value, title, copy]) => (
          <button key={value} type="button" className={purpose === value ? "btn is-selected" : "btn"} role="radio" aria-checked={purpose === value} onClick={() => setPurpose(value)}>
            {title}
            <small>{copy}</small>
          </button>
        ))}
      </div>
      <Field label="Session name">
        <input className="control" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
      </Field>
      <Field label="Your name">
        <input className="control" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} />
      </Field>
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
        <label className="row">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>I understand this is shared discovery, not emergency or professional interpretation. Files stay with this session, and suggestions are not treated as verified meanings.</span>
        </label>
      ) : null}
      <Field label="Note" hint="Optional. Visible to both seats.">
        <textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
      </Field>
      <Button tone="primary" type="submit" disabled={pending}>Create session</Button>
      {message ? <Notice>{message}</Notice> : null}
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
      <form className="stack" onSubmit={join}>
        <h2>Join with a code</h2>
        <Field label="Session code">
          <input className="control mono" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required placeholder="TREE-4821" />
        </Field>
        <Field label="Your name">
          <input className="control" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} />
        </Field>
        <Field label="Seat">
          <select className="select" value={role} onChange={(event) => setRole(event.target.value as "A" | "B")}>
            <option value="A">Participant A</option>
            <option value="B">Participant B</option>
          </select>
        </Field>
        <button className="btn btn-primary" type="submit" disabled={pending}>Join</button>
      </form>
      <form className="stack" onSubmit={rejoin}>
        <h2>Rejoin</h2>
        <Field label="Recovery key">
          <input className="control mono" value={recovery} onChange={(event) => setRecovery(event.target.value)} required />
        </Field>
        <button className="btn" type="submit" disabled={pending}>Rejoin</button>
        {message ? <Notice>{message}</Notice> : null}
      </form>
    </div>
  );
}
