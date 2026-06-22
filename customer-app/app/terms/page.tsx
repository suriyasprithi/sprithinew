import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service · SPRITHI",
  description: "The terms that govern your use of SPRITHI.",
};

const UPDATED = "22 June 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed text-neutral-800">
      <Link href="/home" className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to SPRITHI
      </Link>

      <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900">Terms of Service</h1>
      <p className="mt-1 text-sm text-neutral-500">Last updated: {UPDATED}</p>

      <p className="mt-6">
        These terms govern your use of the <strong>SPRITHI</strong> app and website. By creating an account or
        placing an order, you agree to these terms.
      </p>

      <Section title="1. Your account">
        <p>You must be at least 18 years old to register. Keep your login details secure; you are responsible for activity on your account.</p>
      </Section>

      <Section title="2. Orders & payments">
        <p>Prices, availability and delivery charges are shown before you confirm an order. Wallet balance and rewards may be used to pay where available. Applicable taxes are shown at checkout.</p>
      </Section>

      <Section title="3. Wallet & rewards">
        <p>Wallet balance and referral rewards may be used within the app as described in each program. Rewards have no cash value except as expressly provided and may be subject to verification (KYC) before withdrawal.</p>
      </Section>

      <Section title="4. Returns">
        <p>Returns are handled as described in our <Link href="/refunds" className="font-medium text-rose-600 hover:underline">Returns &amp; refunds</Link> policy.</p>
      </Section>

      <Section title="5. Acceptable use">
        <p>Do not misuse the app, attempt to defraud the rewards/referral system, or interfere with its operation. We may suspend accounts that violate these terms.</p>
      </Section>

      <Section title="6. Changes">
        <p>We may update these terms from time to time. Continued use after an update means you accept the revised terms.</p>
      </Section>

      <Section title="7. Contact">
        <p>Questions? Email <a href="mailto:sprithi@gmail.com" className="font-medium text-rose-600 hover:underline">sprithi@gmail.com</a>.</p>
      </Section>

      <p className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
        © {new Date().getFullYear()} SPRITHI. All rights reserved.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <div className="mt-2 text-neutral-700">{children}</div>
    </section>
  );
}
