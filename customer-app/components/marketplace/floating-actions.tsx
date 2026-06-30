"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, ArrowUp, HelpCircle, X } from "lucide-react";

export function FloatingActions() {
  const [showTop, setShowTop] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 md:bottom-6">
        {/* Help widget popup */}
        {helpOpen && (
          <div className="w-64 overflow-hidden rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] shadow-[var(--mk-shadow-md)]">
            <div className="flex items-center justify-between bg-[var(--mk-brand)] px-3 py-2 text-white">
              <p className="text-sm font-semibold">Quick support</p>
              <button onClick={() => setHelpOpen(false)} aria-label="Close" className="rounded-full p-0.5 hover:bg-white/15">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1 p-3 text-sm">
              <a href="tel:+919442025515" className="block rounded-md px-2 py-1.5 text-[var(--mk-text)] hover:bg-[var(--mk-brand-soft)]">📞 Call us</a>
              <a href="mailto:sprithi@gmail.com" className="block rounded-md px-2 py-1.5 text-[var(--mk-text)] hover:bg-[var(--mk-brand-soft)]">✉️ Email</a>
              <Link href="/orders" onClick={() => setHelpOpen(false)} className="block rounded-md px-2 py-1.5 text-[var(--mk-text)] hover:bg-[var(--mk-brand-soft)]">📦 Track order</Link>
            </div>
          </div>
        )}

        <button
          onClick={() => setHelpOpen((v) => !v)}
          aria-label="Help"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--mk-surface)] text-[var(--mk-text)] shadow-[var(--mk-shadow-md)] transition-transform hover:scale-105"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        <a
          href="https://wa.me/919442025515"
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[var(--mk-shadow-md)] transition-transform hover:scale-105"
        >
          <MessageCircle className="h-5 w-5" />
        </a>

        {showTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Scroll to top"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--mk-brand)] text-white shadow-[var(--mk-shadow-md)] transition-transform hover:scale-105"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </>
  );
}
