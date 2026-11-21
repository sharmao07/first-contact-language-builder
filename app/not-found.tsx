import Link from "next/link";

export default function NotFound() {
  return (
    <main id="content" className="wrap section stack">
      <h1>That page is not here</h1>
      <Link href="/">Return home</Link>
    </main>
  );
}
