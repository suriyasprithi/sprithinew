import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy · SPRITHI",
  description: "How the SPRITHI app collects, uses, shares and protects your information.",
};

// Public, static privacy policy — used as the Google Play "privacy policy URL"
// and linked from the footer. Plain (server) component so it renders in the
// static export with no auth. Update the contact block + last-updated date for
// your entity before publishing.
const UPDATED = "17 June 2026";
const SUPPORT_EMAIL = "support@sprithi.com";
const SUPPORT_PHONE = "+91 99999 99999";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed text-neutral-800">
      <Link href="/home" className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to SPRITHI
      </Link>

      <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900">Privacy Policy</h1>
      <p className="mt-1 text-sm text-neutral-500">Last updated: {UPDATED}</p>

      <p className="mt-6">
        This Privacy Policy explains how <strong>SPRITHI</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, the
        &ldquo;App&rdquo;) collects, uses, shares and protects your information when you use the SPRITHI
        mobile application and website — a wallet-powered, multi-vendor marketplace for ordering products
        from local shops. By creating an account or using the App, you agree to this policy.
      </p>

      <Section title="1. Information we collect">
        <p>We collect the following information that you provide or that is generated when you use the App:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li><strong>Account details:</strong> name, mobile number, email address, date of birth and password.</li>
          <li><strong>Location &amp; address:</strong> your state, district, taluk, pincode and the delivery addresses you save. We do <em>not</em> collect GPS/precise device location.</li>
          <li><strong>KYC &amp; bank details</strong> (only if you choose to add them, e.g. to withdraw wallet money): PAN number and PAN image, bank account holder name, account number, IFSC code, bank name and UPI ID.</li>
          <li><strong>Financial &amp; transaction data:</strong> your in-app wallet balance, wallet transactions, orders, referral/commission earnings and cancellation/return records.</li>
          <li><strong>Device &amp; usage data:</strong> a push-notification token (Firebase Cloud Messaging) and basic in-app activity such as orders placed, cart items and pages viewed, used to operate the App.</li>
          <li><strong>Camera (QR scan):</strong> when you use the in-app QR scanner the camera feed is processed on your device only to read the code; we do not store or upload camera images.</li>
        </ul>
      </Section>

      <Section title="2. How we use your information">
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Create and manage your account and verify your identity (KYC).</li>
          <li>Process orders, deliveries, wallet payments, withdrawals and referral commissions.</li>
          <li>Send order updates and account notifications (push notifications).</li>
          <li>Provide customer support and respond to your requests.</li>
          <li>Maintain security, prevent fraud/abuse, and comply with legal obligations.</li>
        </ul>
      </Section>

      <Section title="3. How we share your information">
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li><strong>Vendors &amp; delivery partners:</strong> to fulfil an order we share the necessary order details and delivery address with the seller and the assigned delivery person.</li>
          <li><strong>Service providers:</strong> infrastructure and messaging providers (e.g. Google Firebase Cloud Messaging for push notifications) that help us run the App.</li>
          <li><strong>Legal &amp; compliance:</strong> when required by law, regulation or to protect our rights and users.</li>
        </ul>
        <p className="mt-2">We do <strong>not</strong> sell your personal information to third parties or use it for third-party advertising.</p>
      </Section>

      <Section title="4. App permissions">
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li><strong>Notifications:</strong> to send order and account updates.</li>
          <li><strong>Camera:</strong> only to scan QR codes within the App. You can deny or revoke this permission in your device settings.</li>
        </ul>
      </Section>

      <Section title="5. Data security &amp; retention">
        <p>
          Data is transmitted over encrypted connections (HTTPS). We retain your information for as long as your
          account is active or as needed to provide the App and to meet legal, accounting and tax requirements.
        </p>
      </Section>

      <Section title="6. Account &amp; data deletion" id="data-deletion">
        <p>
          You can request deletion of your account and associated personal data at any time by emailing{" "}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Account%20and%20data%20deletion%20request`} className="font-medium text-rose-600 hover:underline">{SUPPORT_EMAIL}</a>{" "}
          from your registered email or mobile, with the subject &ldquo;Account and data deletion request&rdquo;.
          We will verify your identity and delete your personal data, except records we are required to keep for
          legal, financial or fraud-prevention purposes (such as completed order and transaction records), which
          are retained only for the period the law requires and then deleted.
        </p>
      </Section>

      <Section title="7. Children">
        <p>
          The App is intended for users aged 18 and above. Registration requires you to be at least 18 years old.
          We do not knowingly collect information from children.
        </p>
      </Section>

      <Section title="8. Changes to this policy">
        <p>
          We may update this policy from time to time. The &ldquo;Last updated&rdquo; date above reflects the most
          recent changes. Continued use of the App after an update means you accept the revised policy.
        </p>
      </Section>

      <Section title="9. Contact us">
        <p>For any privacy questions or requests, contact us at:</p>
        <ul className="mt-2 space-y-1">
          <li>Email: <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-rose-600 hover:underline">{SUPPORT_EMAIL}</a></li>
          <li>Phone: {SUPPORT_PHONE}</li>
          <li>Address: Coimbatore, Tamil Nadu, India</li>
        </ul>
      </Section>

      <p className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
        © {new Date().getFullYear()} SPRITHI. All rights reserved.
      </p>
    </main>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-7 scroll-mt-20">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <div className="mt-2 text-neutral-700">{children}</div>
    </section>
  );
}
