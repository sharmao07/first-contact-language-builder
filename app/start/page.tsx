"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await api<{ code: string; token: string; participantId: string; role: string; displayName: string }>("/api/sessions", {
        body: { name, displayName, role, description },
      });
      writeIdentity({ ...result, code: result.code });
      router.push(`/session/${result.code}`);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "Could not create the session.");
      setPending(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h1>Start a discovery session</h1>
      <p>You will get a code like TREE-4821. The other person joins from their own browser.</p>
      <Field label="Session name">
        <input className="control" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
      </Field>
      <Field label="Your name">
        <input className="control" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} />
      </Field>
      <Field label="Your seat">
        <select className="select" value={role} onChange={(event) => setRole(event.target.value as "A" | "B")}>
          <option value="A">Participant A</option>
          <option value="B">Participant B</option>
        </select>
      </Field>
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
      const result = await api<{ code: string; token: string; participantId: string; role: string; displayName: string }>("/api/sessions/join", {
        body: { code, displayName, role },
      });
      writeIdentity(result);
      router.push(`/session/${result.code}`);
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
