"use client";

import { useState } from "react";

export default function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className={className}
    >
      {done ? "복사됨 ✓" : label}
    </button>
  );
}
