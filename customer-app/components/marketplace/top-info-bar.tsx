import Link from "next/link";
import { Phone, Truck } from "lucide-react";

export function TopInfoBar() {
  return (
    <div className="bg-[var(--mk-brand-deep)] text-white">
      <div className="flex w-full items-center justify-end gap-4 px-4 py-1.5 text-[12px]">
        <div className="hidden items-center gap-5 sm:flex">
          <a href="tel:+919345133867" className="flex items-center gap-1.5 hover:underline">
            <Phone className="h-3.5 w-3.5" /> +91 93451 33867
          </a>
          <Link href="/orders" className="flex items-center gap-1.5 hover:underline">
            <Truck className="h-3.5 w-3.5" /> Track order
          </Link>
        </div>
      </div>
    </div>
  );
}
