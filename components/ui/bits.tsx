"use client";

import { AlertCircle, Check, CheckCircle2, Copy, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { displayStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StatusText({ status, reason, pill = false }: { status: string; reason?: string; pill?: boolean }) {
  const tone = statusTone(status);
  if (pill) {
    return (
      <span className="status-pill" data-tone={tone}>
        <span className={`status status-${status}`}>{displayStatus(status, reason)}</span>
      </span>
    );
  }
  return <span className={`status status-${status}`}>{displayStatus(status, reason)}</span>;
}

function statusTone(status: string) {
  if (status === "verified" || status === "confirmed" || status === "understood") return "verified";
  if (status === "disputed" || status === "challenged" || status === "rejected" || status === "reopened" || status === "corrected") return "disputed";
  if (status === "tentative" || status === "testing" || status === "accepted") return "tentative";
  if (status === "hypothesis" || status === "open" || status === "awaiting" || status === "draft") return "hypothesis";
  return "neutral";
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="stack-xs">
      <span className="small" style={{ fontWeight: 500, color: "var(--ink)" }}>{label}</span>
      {children}
      {hint ? <span className="small muted">{hint}</span> : null}
    </label>
  );
}

export function Notice({
  children,
  tone = "info",
  className,
}: {
  children: React.ReactNode;
  tone?: "info" | "warning" | "error" | "success";
  className?: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" || tone === "warning" ? AlertCircle : Info;
  return (
    <div className={cn("banner", className)} data-tone={tone} role="status">
      <Icon size={16} strokeWidth={1.5} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="row-between" style={{ paddingBottom: 20, borderBottom: "1px solid var(--line)" }}>
      <div className="stack-sm" style={{ maxWidth: "46rem" }}>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="small">{description}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </header>
  );
}

export function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="stat-card">
      <p className="small muted">{label}</p>
      <p className="stat-value">{value}</p>
      {detail ? <p className="small muted">{detail}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Info;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-recessed stack-sm" style={{ padding: 24 }}>
      <div className="row" style={{ gap: 10 }}>
        <Icon size={18} strokeWidth={1.5} className="muted" aria-hidden="true" />
        <h3>{title}</h3>
      </div>
      <p className="small">{description}</p>
      {action ? <div className="row" style={{ marginTop: 4 }}>{action}</div> : null}
    </div>
  );
}

export function CopyCodeButton({ code, compact = false }: { code: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      className={compact ? "btn btn-sm btn-tonal" : "btn btn-tonal"}
      aria-live="polite"
      onClick={() => {
        void navigator.clipboard.writeText(code);
        setCopied(true);
      }}
    >
      {copied ? <Check size={14} strokeWidth={1.5} aria-hidden="true" /> : <Copy size={14} strokeWidth={1.5} aria-hidden="true" />}
      <span className="mono">{copied ? "Code copied" : compact ? code : `Copy ${code}`}</span>
    </button>
  );
}
