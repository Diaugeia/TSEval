"use client";

import { Suspense, useState } from "react";
import { Leaderboard, type LeaderboardData } from "@/src/index";
import { DICT, type Locale } from "@/lib/dict";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import raw from "@/data/leaderboard.json";

const data = raw as unknown as LeaderboardData;

// Rendered in a stable locale so the static HTML is deterministic.
const updated = new Date(data.generated_at).toISOString().slice(0, 16).replace("T", " ");

const THEME_LABELS: Record<Locale, { toLight: string; toDark: string }> = {
  en: { toLight: "Switch to light mode", toDark: "Switch to dark mode" },
  zh: { toLight: "切换到白天模式", toDark: "切换到暗夜模式" },
};

export default function Page() {
  const [locale, setLocale] = useState<Locale>("en");
  const copy = DICT[locale];

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <a href="https://diaugeia.ai" aria-label="diaugeia — home">
            <Logo />
          </a>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-border p-0.5 text-[0.8rem]">
              {(["en", "zh"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocale(l)}
                  aria-current={locale === l ? "true" : undefined}
                  className={`rounded-full px-2.5 py-1 leading-none transition-colors ${
                    locale === l ? "bg-ink text-paper" : "text-muted hover:text-ink"
                  }`}
                >
                  {l === "en" ? "EN" : "中文"}
                </button>
              ))}
            </div>
            <ThemeToggle labels={THEME_LABELS[locale]} />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h1 className="font-serif text-4xl tracking-[-0.02em] text-ink sm:text-6xl">{copy.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{copy.lede}</p>
          <p className="mt-6 text-sm text-faint">
            {copy.updated} <span className="text-accent">{updated} UTC</span>
            {" · "}
            <span className="text-accent">{data.n_submissions}</span> {copy.submissions}
            {" · "}
            {copy.rankedBy} {data.primary_metric.toUpperCase()}
          </p>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <Suspense fallback={null}>
          <Leaderboard data={data} copy={copy} />
        </Suspense>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-faint sm:px-8">
          <span>
            διαύγεια · open infrastructure for AI research
          </span>
          <span className="flex gap-4">
            <a className="hover:text-ink" href="https://github.com/Diaugeia/tseval-leaderboard">GitHub</a>
            <a className="hover:text-ink" href="https://github.com/Diaugeia/tseval-leaderboard/tree/main/submissions">Submissions</a>
          </span>
        </div>
      </footer>
    </>
  );
}
