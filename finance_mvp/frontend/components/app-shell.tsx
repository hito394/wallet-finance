"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/documents", label: "Documents" },
  { href: "/reports", label: "Reports" },
  { href: "/chatbot", label: "Chatbot" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const pageTitle = useMemo(() => {
    const match = NAV_ITEMS.find((item) => isActive(pathname, item.href));
    return match?.label || "AI Finance Assistant";
  }, [pathname]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link href="/" className="brand" onClick={() => setOpen(false)}>
            AI Finance Assistant
          </Link>
          <span className="route-pill">{pageTitle}</span>
        </div>

        <button
          type="button"
          className="mobile-menu-btn"
          aria-label="Toggle navigation"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Close" : "Menu"}
        </button>

        <nav className="topnav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`topnav-link ${isActive(pathname, item.href) ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {open && (
        <nav className="mobile-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      <main className="app-content">{children}</main>
    </div>
  );
}
