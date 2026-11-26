"use client";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main id="content" className="wrap-narrow page-pad">
      <div className="surface stack">
        <p className="eyebrow">Application error</p>
        <h1>Something went wrong</h1>
        <p className="small">{error.message || "The page could not be shown."}</p>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
        </div>
      </div>
    </main>
  );
}
