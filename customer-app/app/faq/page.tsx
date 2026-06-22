import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "FAQ · SPRITHI",
  description: "Frequently asked questions about SPRITHI.",
};

const FAQS: { q: string; a: string }[] = [
  { q: "How do I place an order?", a: "Pick your location, browse shops near you, add items to your cart and check out. You pay using your in-app wallet balance or cash on delivery where available." },
  { q: "What is the SPRITHI wallet?", a: "Your wallet holds your balance and rewards. You can pay for orders with it and earn referral bonuses that are credited to it." },
  { q: "How does the referral program work?", a: "Share your referral link or QR code. When someone signs up with your code, you earn a welcome bonus, and you keep earning across referral levels. See the Refer page for your full history." },
  { q: "How do delivery charges work?", a: "Delivery charges depend on your order and chosen delivery time. The exact charge is shown at checkout before you pay." },
  { q: "How can I track my order?", a: "Open the Orders page to see each order's current status — from placed through to delivered." },
];

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed text-neutral-800">
      <Link href="/home" className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to SPRITHI
      </Link>

      <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900">Frequently asked questions</h1>

      <div className="mt-6 space-y-6">
        {FAQS.map((f) => (
          <section key={f.q}>
            <h2 className="text-base font-semibold text-neutral-900">{f.q}</h2>
            <p className="mt-1.5 text-neutral-700">{f.a}</p>
          </section>
        ))}
      </div>

      <p className="mt-8">
        Still need help? Visit <Link href="/help" className="font-medium text-rose-600 hover:underline">Customer support</Link>.
      </p>

      <p className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
        © {new Date().getFullYear()} SPRITHI. All rights reserved.
      </p>
    </main>
  );
}
