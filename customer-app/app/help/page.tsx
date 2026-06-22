import Link from "next/link";
import { ArrowLeft, Mail, Phone, MapPin } from "lucide-react";

export const metadata = {
  title: "Customer support · SPRITHI",
  description: "Get help with your SPRITHI orders, wallet and account.",
};

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed text-neutral-800">
      <Link href="/home" className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to SPRITHI
      </Link>

      <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900">Customer support</h1>
      <p className="mt-6">
        Need help with an order, your wallet or your account? Reach us any of these ways and we&apos;ll get back
        to you as soon as possible.
      </p>

      <ul className="mt-6 space-y-3">
        <li className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 text-rose-600" /> <a href="tel:+919442025515" className="font-medium hover:underline">+91 94420 25515</a></li>
        <li className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 text-rose-600" /> <a href="mailto:sprithi@gmail.com" className="font-medium hover:underline">sprithi@gmail.com</a></li>
        <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-rose-600" /> SPRITHI DIGITAL MART PRIVATE LIMITED, Kottaimetu, Villianur, Pondicherry 605110</li>
      </ul>

      <p className="mt-6">
        You can also track your orders from the <Link href="/orders" className="font-medium text-rose-600 hover:underline">Orders</Link> page
        or read common questions in our <Link href="/faq" className="font-medium text-rose-600 hover:underline">FAQ</Link>.
      </p>

      <p className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
        © {new Date().getFullYear()} SPRITHI. All rights reserved.
      </p>
    </main>
  );
}
