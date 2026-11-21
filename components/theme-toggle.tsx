"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("fclb-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button type="button" className="btn" onClick={toggle} aria-pressed={dark}>
      {dark ? "Light theme" : "Dark theme"}
    </button>
  );
}
