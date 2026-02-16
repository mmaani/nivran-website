"use client";

import { useMemo, useState } from "react";

type FAQ = { q: string; a: string };

export default function FAQAccordion({ faqs }: { faqs: FAQ[] }) {
  const [openIndex, setOpenIndex] = useState<number>(-1);

  const chevron = useMemo(() => "▾", []);

  return (
    <>
      <style>{`
        .faq-summary { list-style: none; }
        .faq-summary::-webkit-details-marker { display: none; }

        .faq-summary{
          border-radius: 14px;
          padding: .85rem 1rem;
          border: 1px solid var(--line);
          background: var(--bg-soft);
          transition: background 150ms ease, border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .faq-summary:hover{
          background: rgba(255,255,255,.92);
          transform: translateY(-1px);
        }

        details[open] > summary.faq-summary{
          background: #fff;
          border-color: rgba(199,165,106,.45);
          box-shadow: 0 10px 24px var(--shadow);
        }

        .faq-left{
          display: flex;
          align-items: center;
          gap: .7rem;
          flex: 1;
          min-width: 0;
        }

        .faq-accent{
          width: 4px;
          height: 18px;
          border-radius: 999px;
          background: rgba(199,165,106,.18);
          transition: background 150ms ease;
          flex: 0 0 auto;
        }
        details[open] .faq-accent{
          background: rgba(199,165,106,.85);
        }

        .faq-chevron{
          transition: transform 150ms ease;
          opacity: .7;
          flex: 0 0 auto;
        }
        details[open] .faq-chevron{
          transform: rotate(180deg);
        }
      `}</style>

      <div style={{ display: "grid", gap: ".8rem" }}>
        {faqs.map((item, idx) => (
          <article key={item.q} className="panel">
            <details
              open={openIndex === idx}
              onToggle={(e) => {
                const el = e.currentTarget;
                if (el.open) setOpenIndex(idx);
                else if (openIndex === idx) setOpenIndex(-1);
              }}
            >
              <summary className="faq-summary" style={{ cursor: "pointer", fontWeight: 700 }}>
                <div className="faq-left">
                  <span className="faq-accent" aria-hidden="true" />
                  <span>{item.q}</span>
                </div>
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
