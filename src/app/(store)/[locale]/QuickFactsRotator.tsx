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

  useEffect(() => {
    if (reducedMotion || paused || facts.length < 2) return;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % facts.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [facts.length, paused, reducedMotion]);

  const visibleFacts = useMemo(
    () => [0, 1, 2].map((offset) => facts[(active + offset) % facts.length]).filter(Boolean),
    [active, facts],
  );

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
            className={`quick-dot${idx === active ? " is-active" : ""}`}
            aria-label={fact.title}
            aria-pressed={idx === active}
            onClick={() => setActive(idx)}
          />
        ))}
      </div>
    </div>
  );
}
