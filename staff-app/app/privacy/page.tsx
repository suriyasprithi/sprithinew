import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy · SPRITHI Staff",
  description: "How the SPRITHI Staff app collects, uses, shares and protects information for vendors, partners and staff.",
};

// Public, static privacy policy for the SPRITHI Staff app (vendors, district/
// taluk partners, delivery drivers and admins). Used as the Google Play
// "privacy policy URL" and linked from the login screen. Plain (server)
// component so it renders in the static export with no auth. Update the contact
// block + last-updated date for your entity before publishing.
const UPDATED = "30 June 2026";
const SUPPORT_EMAIL = "sprithi@gmail.com";
const SUPPORT_PHONE = "+91 94420 25515";
const SUPPORT_ADDRESS = "SPRITHI DIGITAL MART PRIVATE LIMITED, Kottaimetu, Villianur, Pondicherry 605110";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed text-neutral-800">
      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to login
      </Link>

      <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900">Privacy Policy</h1>
      <p className="mt-1 text-sm text-neutral-500">SPRITHI Staff app · Last updated: {UPDATED}</p>

      <p className="mt-6">
        This Privacy Policy explains how <strong>SPRITHI</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, the
        &ldquo;App&rdquo;) collects, uses, shares and protects information when you use the <strong>SPRITHI Staff</strong>
        {" "}application and website. The Staff app is the business and operations side of the SPRITHI marketplace, used
        by vendors (shop owners), regional partners (state / district / taluk), delivery drivers and administrators to
        manage shops, products, orders, payments and payouts. By signing in or using the App, you agree to this policy.
      </p>

      <Section title="1. Information we collect">
        <p>We collect the following information that you provide or that is generated when you use the App:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li><strong>Account details:</strong> name, mobile number, email address, password and your role (vendor, partner, driver or admin).</li>
          <li><strong>Business / shop details</strong> (vendors): shop name, shop category, GST number, service area and the products, prices, stock and images you upload.</li>
          <li><strong>KYC &amp; bank details</strong> (for commissions, payouts and wallet withdrawals): PAN number and PAN image, bank account holder name, account number, IFSC code, bank name and UPI ID.</li>
          <li><strong>Location &amp; service area:</strong> your state, district, taluk and pincode used to scope shops, orders and deliveries. We do <em>not</em> collect GPS/precise device location.</li>
          <li><strong>Operational &amp; financial data:</strong> orders you receive or fulfil, wallet and token balances and transactions, commission and referral earnings, driver salary / COD reconciliation, and cancellation / return records.</li>
          <li><strong>Device &amp; usage data:</strong> a push-notification token (Firebase Cloud Messaging) and basic in-app activity used to operate the App.</li>
          <li><strong>Camera (QR scan):</strong> when you use the in-app QR scanner (e.g. to accept a customer wallet payment) the camera feed is processed on your device only to read the code; we do not store or upload camera images.</li>
        </ul>
      </Section>

      <Section title="2. How we use your information">
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Create and manage your staff account and verify your identity (KYC).</li>
          <li>Operate your shop: list products, receive and process orders, and assign deliveries.</li>
          <li>Process wallet / token transactions, QR payments, commissions, payouts and driver settlements.</li>
          <li>Send order, payment and account notifications (push notifications).</li>
          <li>Provide support and respond to your requests.</li>
          <li>Maintain security, prevent fraud/abuse, and comply with legal, accounting and tax obligations.</li>
        </ul>
      </Section>

      <Section title="3. How we share your information">
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li><strong>Customers:</strong> to fulfil an order, the relevant shop and product details (and, for the assigned driver, the delivery address and contact) are shared with the customer and delivery person.</li>
          <li><strong>Within the SPRITHI hierarchy:</strong> administrators and the regional partners above your account may see operational data needed to manage the marketplace (e.g. orders, commissions, payouts).</li>
          <li><strong>Service providers:</strong> infrastructure and messaging providers (e.g. Google Firebase Cloud Messaging for push notifications) that help us run the App.</li>
          <li><strong>Legal &amp; compliance:</strong> when required by law, regulation or to protect our rights and users.</li>
        </ul>
        <p className="mt-2">We do <strong>not</strong> sell your personal information to third parties or use it for third-party advertising.</p>
      </Section>

      <Section title="4. App permissions">
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li><strong>Notifications:</strong> to send order, payment and account updates.</li>
          <li><strong>Camera:</strong> only to scan QR codes within the App (e.g. accepting customer payments). You can deny or revoke this permission in your device settings.</li>
          <li><strong>Photos / files:</strong> only when you choose to upload product images, shop images, KYC documents or ad/return media.</li>
        </ul>
      </Section>

      <Section title="5. Data security &amp; retention">
        <p>
          Data is transmitted over encrypted connections (HTTPS). We retain your information for as long as your
          account is active or as needed to operate the App and to meet legal, accounting and tax requirements
          (for example, completed order, payout and tax records).
        </p>
      </Section>

      <Section title="6. Account &amp; data deletion" id="data-deletion">
        <p>
          You can request deletion of your account and associated personal data at any time by emailing{" "}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Staff%20account%20and%20data%20deletion%20request`} className="font-medium text-rose-600 hover:underline">{SUPPORT_EMAIL}</a>{" "}
          from your registered email or mobile, with the subject &ldquo;Staff account and data deletion request&rdquo;.
          We will verify your identity and delete your personal data, except records we are required to keep for legal,
          financial or fraud-prevention purposes (such as completed order, transaction and payout records), which are
          retained only for the period the law requires and then deleted.
        </p>
      </Section>

      <Section title="7. Eligibility">
        <p>
          The Staff app is intended for business users aged 18 and above who operate or support a SPRITHI shop,
          region or delivery role. We do not knowingly collect information from children.
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
          <li>Address: {SUPPORT_ADDRESS}</li>
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
