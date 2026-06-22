import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "About us · SPRITHI",
  description: "About SPRITHI — a wallet-powered local marketplace.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed text-neutral-800">
      <Link href="/home" className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to SPRITHI
      </Link>

      <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900">About us</h1>

      <p className="mt-6">
        <strong>SPRITHI</strong> is a wallet-powered, multi-vendor marketplace that connects you with local
        shops for groceries, food, services and more — delivered fast in your area.
      </p>
      <p className="mt-4">
        Pay using your in-app wallet, earn rewards through our referral program, and support sellers in your
        own town and taluk. We keep things simple, local and reliable.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Company</h2>
      <ul className="mt-2 space-y-1 text-neutral-700">
        <li>SPRITHI DIGITAL MART PRIVATE LIMITED</li>
        <li>Kottaimetu, Villianur, Pondicherry 605110</li>
        <li>Phone: +91 94420 25515</li>
        <li>Email: <a href="mailto:sprithi@gmail.com" className="font-medium text-rose-600 hover:underline">sprithi@gmail.com</a></li>
      </ul>

      <p className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
        © {new Date().getFullYear()} SPRITHI. All rights reserved.
      </p>
    </main>
  );
}
