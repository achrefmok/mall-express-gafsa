"use client";

import { useEffect, useState } from "react";
import { monogram } from "@/lib/format";
import { StoryViewer } from "./story-viewer";
import type { StoryBoutique } from "@/lib/boutique-themes/attributs-server";

function cleVue(storyId: string): string {
  return `gm-story-vue:${storyId}`;
}

/**
 * Rail de stories sous l'en-tête — masqué entièrement si la boutique n'en a
 * aucune active (`lireStoriesBoutique` revient alors à `[]`).
 */
export function StoriesRail({
  stories,
  shopSlug,
  shopName,
}: {
  stories: StoryBoutique[];
  shopSlug: string;
  shopName: string;
}) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  /*
    `localStorage` n'existe pas côté serveur : le lire pendant le rendu
    ferait planter cette page, qui est un Server Component au premier
    rendu. L'état "vu" part donc vide, puis se remplit après montage —
    au pire, l'anneau dégradé reste un instant sur une story déjà vue.
  */
  const [vues, setVues] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const trouvees = stories.filter((s) => localStorage.getItem(cleVue(s.id)) === "1").map((s) => s.id);
      if (trouvees.length > 0) setVues(new Set(trouvees));
    } catch {
      // navigation privée ou stockage bloqué : tant pis, tout reste "non vu"
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalculé seulement si la liste de stories change de longueur
  }, [stories.length]);

  if (stories.length === 0) return null;

  const mono = monogram(shopName);

  return (
    <>
      <div className="no-sb flex flex-none gap-[14px] overflow-x-auto px-4 pt-1 pb-1">
        {stories.map((story, i) => {
          const vue = vues.has(story.id);
          return (
            <button
              key={story.id}
              type="button"
              onClick={() => setOuverte(i)}
              className="flex flex-none flex-col items-center gap-[5px]"
              style={{ width: 60 }}
            >
              <span
                className="flex h-[57px] w-[57px] items-center justify-center rounded-full p-[2.5px]"
                style={{
                  background: vue
                    ? "var(--color-outline)"
                    : "linear-gradient(135deg,var(--theme-accent,var(--color-brand)),var(--color-live),#e0a35a)",
                }}
              >
                <span
                  className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[2.5px] border-[var(--color-app)] bg-[var(--theme-accent-doux,var(--color-brand-tint))] bg-cover bg-center text-[0.875rem] font-bold text-[var(--theme-accent-fort,var(--color-brand))]"
                  style={story.image_url ? { backgroundImage: `url(${story.image_url})` } : undefined}
                >
                  {!story.image_url && mono}
                </span>
              </span>
              <span
                className="truncate text-[0.59375rem] text-[var(--color-ink)]"
                style={{ fontWeight: vue ? 500 : 700 }}
              >
                {story.label}
              </span>
            </button>
          );
        })}
      </div>

      {ouverte !== null && (
        <StoryViewer
          stories={stories}
          shopSlug={shopSlug}
          shopMonogram={mono}
          shopName={shopName}
          indexDepart={ouverte}
          onClose={() => {
            try {
              for (const s of stories) localStorage.setItem(cleVue(s.id), "1");
            } catch {
              // navigation privée ou stockage bloqué : tant pis
            }
            setVues(new Set(stories.map((s) => s.id)));
            setOuverte(null);
          }}
        />
      )}
    </>
  );
}
