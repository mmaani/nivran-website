"use client";

import { useMemo, useState } from "react";

type FAQ = { q: string; a: string };

export default function FAQAccordion({
  faqs,
  isAr,
}: {
  faqs: FAQ[];
  isAr: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number>(-1); 

  const chevron = useMemo(() => {
    // keep same symbol in both languages; rotation handles direction visually
    return "▾";
  }, []);

  return (
    <>
      {/* tiny behavior-only styling for the chevron */}
      <style>{`
        .faq-summary { list-style: none; }
        .faq-summary::-webkit-details-marker { display: none; }
        .faq-chevron { transition: transform 150ms ease; opacity: .7; }
        details[open] .faq-chevron { transform: rotate(180deg); }
      `}</style>

      <div style={{ display: "grid", gap: ".8rem" }}>
        {faqs.map((item, idx) => (
          <article key={item.q} className="panel">
            <details
              open={openIndex === idx}
              onToggle={(e) => {
                const el = e.currentTarget;
                // If user opens this one => set it as active. If they close it => set none open.
                if (el.open) setOpenIndex(idx);
                else if (openIndex === idx) setOpenIndex(-1);
              }}
            >
              <summary
                className="faq-summary"
                style={{
                  cursor: "pointer",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <span>{item.q}</span>
                <span className="faq-chevron" aria-hidden="true">
                  {chevron}
                </span>
              </summary>

              <div style={{ marginTop: ".65rem" }}>
                <p style={{ marginBottom: 0 }} className="muted">
                  {item.a}
                </p>
              </div>
            </details>
          </article>
        ))}
      </div>
    </>
  );
}
