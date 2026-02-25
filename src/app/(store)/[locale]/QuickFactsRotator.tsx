"use client";

import { useEffect, useMemo, useState } from "react";

type Fact = { title: string; body: string };

export default function QuickFactsRotator({
  facts,
  dotsLabel,
}: {
  facts: Fact[];
  dotsLabel: string;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const factCount = facts.length;

  useEffect(() => {
    if (factCount === 0) {
      setActive(0);
      return;
    }
    setActive((current) => (current >= factCount ? 0 : current));
  }, [factCount]);

  useEffect(() => {
    if (reducedMotion || paused || factCount < 2) return;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % factCount);
    }, 5000);
    return () => window.clearInterval(id);
  }, [factCount, paused, reducedMotion]);

  const normalizedActive = factCount > 0 ? active % factCount : 0;

  const visibleFacts = useMemo(() => {
    if (factCount === 0) return [] as Fact[];
    if (reducedMotion) return facts.slice(0, Math.min(3, factCount));
    return [0, 1, 2].map((offset) => facts[(normalizedActive + offset) % factCount]);
  }, [factCount, facts, normalizedActive, reducedMotion]);

  if (factCount === 0) return null;

  return (
    <div
      className="quick-facts"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="quick-facts-row">
        {visibleFacts.map((fact, idx) => (
          <article key={`${fact.title}-${idx}`} className="quick-fact">
            <h4>{fact.title}</h4>
            <p>{fact.body}</p>
          </article>
        ))}
      </div>
      <div className="quick-facts-dots" aria-label={dotsLabel}>
        {facts.map((fact, idx) => (
          <button
            key={fact.title}
            type="button"
            className={`quick-dot${idx === normalizedActive ? " is-active" : ""}`}
            aria-label={fact.title}
            aria-pressed={idx === normalizedActive}
            onClick={() => setActive(idx)}
          />
        ))}
      </div>
    </div>
  );
}
