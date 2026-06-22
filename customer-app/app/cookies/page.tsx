import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Cookie Policy · SPRITHI",
  description: "How SPRITHI uses cookies and local storage.",
};

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed text-neutral-800">
      <Link href="/home" className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to SPRITHI
      </Link>

      <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900">Cookie Policy</h1>

      <p className="mt-6">
        SPRITHI uses cookies and on-device storage (such as local storage) only to keep the app working — for
        example, to keep you signed in, remember your selected delivery location and store your cart.
      </p>
      <p className="mt-4">
        We do not use cookies for third-party advertising or to sell your data. You can clear this data any time
        from your browser or device settings, though doing so will sign you out and reset your saved preferences.
      </p>
      <p className="mt-4">
        For more on the data we handle, see our <Link href="/privacy" className="font-medium text-rose-600 hover:underline">Privacy Policy</Link>.
      </p>

      <p className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
        © {new Date().getFullYear()} SPRITHI. All rights reserved.
      </p>
    </main>
  );
}
