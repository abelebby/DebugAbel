"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function Topbar({ name }: { name: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const link = (href: string, label: string) => (
    <Link href={href} className={pathname === href ? "active" : ""}>
      {label}
    </Link>
  );

  return (
    <header className="topbar">
      <span className="brand">🐞 Bug Tracker</span>
      <nav className="nav">
        {link("/", "Bugs")}
        {link("/new", "Report a bug")}
        {link("/settings", "Projects & features")}
      </nav>
      <span className="spacer" />
      <span className="who">{name}</span>
      <ThemeToggle />
      <button onClick={logout}>Log out</button>
    </header>
  );
}
