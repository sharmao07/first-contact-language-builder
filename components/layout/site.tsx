"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const SITE_LINKS = [
  ["/", "Overview"],
  ["/sessions", "Sessions"],
  ["/research", "Research"],
  ["/settings", "Settings"],
  ["/privacy", "Privacy"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="wrap site-header-bar">
        <Link className="wordmark" href="/">
          <span className="reading-mark" aria-hidden="true" />
          First-Contact
        </Link>
        <nav className="site-links" aria-label="Site">
          {SITE_LINKS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="site-tools">
          <ThemeToggle />
          <Link className="btn btn-primary btn-sm site-start" href="/start">Start a session</Link>
        </div>
        <details className="site-menu">
          <summary className="btn btn-sm" aria-label="Open navigation menu">
            <Menu size={16} strokeWidth={1.5} aria-hidden="true" />
            Menu
          </summary>
          <nav aria-label="Site">
            {SITE_LINKS.map(([href, label]) => (
              <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
                {label}
              </Link>
            ))}
            <Link className="btn btn-primary" href="/start" style={{ marginTop: 8 }}>Start a session</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer-grid">
        <div className="stack-xs">
          <div className="wordmark">
            <span className="reading-mark" aria-hidden="true" />
            First-Contact Language Builder
          </div>
          <p className="small">Don&apos;t assume meaning. Discover it together.</p>
          <p className="small muted">Local-first discovery records. Nothing here is published, and nothing is used to train a model.</p>
        </div>
        <div className="site-footer-links">
          <Link href="/start">Start or join</Link>
          <Link href="/demo">Sample session</Link>
          <Link href="/sessions">Sessions</Link>
          <Link href="/settings">Settings</Link>
          <Link href="/privacy">Privacy and deletion</Link>
        </div>
      </div>
    </footer>
  );
}
