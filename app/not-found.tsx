import Link from "next/link";

export default function NotFound() {
  return (
    <main id="content" className="wrap-narrow page-pad">
      <div className="surface stack">
        <p className="eyebrow">404</p>
        <h1>That page is not here</h1>
        <p className="small">Check the session code or return to the overview.</p>
        <div className="row">
          <Link className="btn btn-primary" href="/">Return home</Link>
          <Link className="btn" href="/start">Start or join</Link>
        </div>
      </div>
    </main>
  );
}
