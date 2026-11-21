import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="site-header wrap">
      <Link href="/">First-Contact</Link>
      <nav>
        <Link href="/">Overview</Link>
        <Link href="/sessions">Sessions</Link>
        <Link href="/research">Research</Link>
        <Link href="/settings">Settings</Link>
        <Link href="/privacy">Privacy</Link>
        <ThemeToggle />
        <Link className="btn btn-primary" href="/start">Start a session</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="section">
      <div className="wrap stack-sm">
        <p className="mono small">Building understanding where language ends.</p>
        <p className="small muted">Local-first discovery records. Nothing here is published, and nothing is used to train a model.</p>
        <p className="small"><Link href="/privacy">Privacy and deletion</Link></p>
      </div>
    </footer>
  );
}
