"use client";

import Link from "next/link";
import { useState } from "react";
import { cx } from "@/lib/format";

interface Column {
  title: string;
  steps: string[];
  cta: { href: string; label: string } | null;
}

/** « Vous achetez » / « Vous tenez une boutique », un seul parcours à la fois plutôt que deux colonnes à parcourir des yeux. */
export function FonctionnementTabs({ columns }: { columns: readonly Column[] }) {
  const [active, setActive] = useState(0);
  const column = columns[active];

  return (
    <div>
      <div className="inline-flex gap-1 rounded-[18px] bg-[var(--color-brand-tint)] p-[5px]">
        {columns.map((c, i) => (
          <button
            key={c.title}
            type="button"
            onClick={() => setActive(i)}
            className={cx(
              "rounded-[14px] px-[18px] py-[10px] text-[0.875rem] font-bold transition-colors",
              i === active ? "bg-[var(--color-surface-solid)] text-[var(--color-brand)] shadow-[0_6px_16px_rgba(60,40,90,0.1)]" : "text-[var(--color-muted)]",
            )}
          >
            {c.title}
          </button>
        ))}
      </div>

      <ol key={column.title} className="animate-slide-up mt-8 flex flex-col gap-5">
        {column.steps.map((step, index) => (
          <li key={step} className="flex gap-4">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--color-brand-tint)] text-[0.8125rem] font-bold text-[var(--color-brand)]">
              {index + 1}
            </span>
            <p className="pt-[6px] text-[0.90625rem] leading-[1.6] text-[var(--color-muted)]">{step}</p>
          </li>
        ))}
      </ol>

      {column.cta && (
        <Link
          href={column.cta.href}
          className="mt-6 inline-flex min-h-[46px] items-center rounded-[16px] bg-[var(--color-ink)] px-6 text-[0.84375rem] font-bold text-[var(--color-app)] transition-transform hover:-translate-y-0.5"
        >
          {column.cta.label}
        </Link>
      )}
    </div>
  );
}
