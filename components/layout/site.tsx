import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const SITE_LINKS = [
  ["/", "Overview"],
  ["/sessions", "Sessions"],
  ["/research", "Research"],
  ["/settings", "Settings"],
  ["/privacy", "Privacy"],
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap site-header-bar">
        <Link className="wordmark" href="/">
          <span className="reading-mark" aria-hidden="true" />
          First-Contact
        </Link>
        <nav className="site-links" aria-label="Site">
          {SITE_LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="site-tools">
          <ThemeToggle />
          <Link className="btn btn-primary site-start" href="/start">Start a session</Link>
        </div>
        <details className="site-menu">
          <summary className="btn">Menu</summary>
          <nav aria-label="Site">
            {SITE_LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            <Link className="btn btn-primary" href="/start">Start a session</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="section">
      <div className="wrap stack-sm">
        <p className="mono small">Don&apos;t assume meaning. Discover it together.</p>
        <p className="small muted">Local-first discovery records. Nothing here is published, and nothing is used to train a model.</p>
        <p className="small"><Link href="/privacy">Privacy and deletion</Link></p>
      </div>
    </footer>
  );
}
