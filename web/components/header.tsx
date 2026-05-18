import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-white/10 bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/70 sticky top-0 z-40">
      <div className="mx-auto flex w-full max-w-container items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-3">
          <svg
            className="h-7 w-9 text-accent"
            viewBox="0 0 56 36"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 31 L28 7 L52 31" strokeWidth="3.2" />
            <path d="M3 31 L53 31" strokeWidth="3.2" />
            <path d="M28 7 L28 31 M15 20 L28 31 L41 20" strokeWidth="2.4" />
          </svg>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide">ACTION STUDIO</div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-accent font-semibold">
              Factory
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/">New run</NavLink>
          <NavLink href="/runs">History</NavLink>
          <NavLink href="/settings">Settings</NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-muted transition hover:bg-white/5 hover:text-ink"
    >
      {children}
    </Link>
  );
}
