import { STATUS_LABEL } from "@/lib/constants";

export function StatusText({ status }: { status: string }) {
  return <span className={`status status-${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="stack-sm">
      <span className="small">{label}</span>
      {children}
      {hint ? <span className="small muted">{hint}</span> : null}
    </label>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="banner small" role="status">{children}</div>;
}
