"use client";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main id="content" className="wrap section stack">
      <h1>Something went wrong</h1>
      <p>{error.message || "The page could not be shown."}</p>
      <button type="button" className="btn" onClick={reset}>Try again</button>
    </main>
  );
}
