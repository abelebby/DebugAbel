"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    // Remember the explicit choice; until then the system preference wins.
    try {
      localStorage.setItem("bt-theme", next);
    } catch {}
  }

  return (
    <button onClick={toggle} title="Toggle dark mode" aria-label="Toggle dark mode">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
