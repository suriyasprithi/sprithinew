import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Returns & refunds · SPRITHI",
  description: "SPRITHI returns and refunds policy.",
};

export default function RefundsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed text-neutral-800">
      <Link href="/home" className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to SPRITHI
      </Link>

      <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900">Returns &amp; refunds</h1>

      <p className="mt-6">
        If an item you received is damaged, incorrect or missing, please raise a return request from your{" "}
        <Link href="/orders" className="font-medium text-rose-600 hover:underline">Orders</Link> page within the
        return window shown for that order, or contact us.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">How returns work</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-neutral-700">
        <li>Open the order and choose <strong>Request return</strong> on an eligible order.</li>
        <li>The seller reviews your request and, once approved, the applicable amount is credited back to your SPRITHI wallet.</li>
        <li>Perishable, used or final-sale items may not be eligible for return.</li>
      </ul>

      <p className="mt-6">
        For any help with a return, reach <Link href="/help" className="font-medium text-rose-600 hover:underline">Customer support</Link>.
      </p>

      <p className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
        © {new Date().getFullYear()} SPRITHI. All rights reserved.
      </p>
    </main>
  );
}
