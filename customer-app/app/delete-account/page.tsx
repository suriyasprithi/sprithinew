import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Delete your account · SPRITHI",
  description: "How to request deletion of your SPRITHI account and associated personal data.",
};

// Public, static account-deletion page — used as the Google Play
// "Delete account URL". Plain (server) component so it renders in the static
// export with no auth. Keep the contact block in sync with the privacy page.
const UPDATED = "17 June 2026";
const SUPPORT_EMAIL = "info@sprithi.com";
const SUPPORT_PHONE = "+91 93451 33867";
const MAILTO = `mailto:${SUPPORT_EMAIL}?subject=Account%20and%20data%20deletion%20request`;

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed text-neutral-800">
      <Link href="/home" className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to SPRITHI
      </Link>

      <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900">Delete your account</h1>
      <p className="mt-1 text-sm text-neutral-500">Last updated: {UPDATED}</p>

      <p className="mt-6">
        This page explains how to request deletion of your <strong>SPRITHI</strong> account
        (app <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">com.epey.customer</code>) and the
        personal data associated with it. SPRITHI is a wallet-powered, multi-vendor marketplace for ordering
        products from local shops.
      </p>

      <Section title="How to request deletion">
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            Send an email to{" "}
            <a href={MAILTO} className="font-medium text-rose-600 hover:underline">{SUPPORT_EMAIL}</a>{" "}
            from the email address or mobile number registered on your SPRITHI account, with the subject{" "}
            <strong>&ldquo;Account and data deletion request&rdquo;</strong>.
          </li>
          <li>Include your registered <strong>name</strong> and <strong>mobile number</strong> so we can locate your account.</li>
          <li>
            You can also call us at <strong>{SUPPORT_PHONE}</strong> to make the request.
          </li>
          <li>We verify your identity and then delete your account. This is completed within <strong>30 days</strong> of a verified request.</li>
        </ol>
        <p className="mt-4">
          <a
            href={MAILTO}
            className="inline-flex items-center rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Email a deletion request
          </a>
        </p>
      </Section>

      <Section title="What data is deleted">
        <p>Once your request is verified, we delete the personal data linked to your account, including:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Your name, mobile number, email address and date of birth.</li>
          <li>Your saved delivery addresses and region (state/district/taluk/pincode).</li>
          <li>Any KYC and bank details you added (PAN, PAN image, bank account, IFSC, UPI ID).</li>
          <li>Your push-notification token and in-app activity profile.</li>
        </ul>
      </Section>

      <Section title="What we keep, and for how long">
        <p>
          Some records are retained only where the law requires it — for example completed order, payment,
          wallet and tax/accounting records, and information needed for fraud prevention. These are kept only
          for the period required by law and are then deleted. We do not use retained records for marketing.
        </p>
        <p className="mt-2">
          Note: any remaining in-app wallet balance is forfeited on account deletion unless a withdrawal is
          completed beforehand. Please withdraw your balance before requesting deletion.
        </p>
      </Section>

      <Section title="Contact">
        <ul className="mt-2 space-y-1">
          <li>Email: <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-rose-600 hover:underline">{SUPPORT_EMAIL}</a></li>
          <li>Phone: {SUPPORT_PHONE}</li>
          <li>Address: Coimbatore, Tamil Nadu, India</li>
        </ul>
        <p className="mt-3 text-sm text-neutral-500">
          See also our{" "}
          <Link href="/privacy" className="font-medium text-rose-600 hover:underline">Privacy Policy</Link>.
        </p>
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
