import Link from "next/link";
import { Clock, Phone, FileText, Truck } from "lucide-react";

export function TopInfoBar() {
  return (
    <div className="bg-[var(--mk-brand-deep)] text-white">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-1.5 text-[12px]">
        <p className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Delivery in <span className="font-semibold">8 min</span> · Order before 9 PM
        </p>
        <div className="hidden items-center gap-5 sm:flex">
          <a href="tel:+919999999999" className="flex items-center gap-1.5 hover:underline">
            <Phone className="h-3.5 w-3.5" /> +91 99999 99999
          </a>
          <Link href="/contact" className="hover:underline">Contact</Link>
          <Link href="/blog" className="hover:underline">Blog</Link>
          <Link href="/orders" className="flex items-center gap-1.5 hover:underline">
            <Truck className="h-3.5 w-3.5" /> Track order
          </Link>
          <Link href="/help" className="flex items-center gap-1.5 hover:underline">
            <FileText className="h-3.5 w-3.5" /> Help
          </Link>
        </div>
      </div>
    </div>
  );
}
