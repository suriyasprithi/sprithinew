"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Phone, MapPin, Smartphone, Globe, Camera, MessageCircle, Video } from "lucide-react";
import { toast } from "sonner";

export function MarketplaceFooter() {
  const [email, setEmail] = useState("");

  function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.match(/.+@.+\..+/)) { toast.error("Enter a valid email"); return; }
    toast.success("Subscribed! Check your inbox.");
    setEmail("");
  }

  return (
    <footer className="bg-[var(--mk-text)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand + newsletter */}
          <div className="lg:col-span-2">
            <Link href="/home" className="inline-flex items-center gap-2">
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="SPRITHI Digital Mart" className="h-10 w-10 shrink-0 object-contain" />
              <span className="text-xl font-bold">SPRITHI</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-white/70">
              Your local wallet-powered marketplace. Groceries, services, food, and more — delivered fast.
            </p>

            <form onSubmit={subscribe} className="mt-5 flex max-w-sm gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-white/40 focus:border-[var(--mk-brand)] focus:outline-none"
              />
              <button type="submit" className="rounded-xl bg-[var(--mk-brand)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--mk-brand-deep)]">
                Subscribe
              </button>
            </form>
            <p className="mt-2 text-[11px] text-white/40">Get offers, new products and updates in your inbox.</p>

            <div className="mt-5 flex gap-3">
              <Social href="#" Icon={Globe}         label="Facebook" />
              <Social href="#" Icon={Camera}        label="Instagram" />
              <Social href="#" Icon={MessageCircle} label="Twitter" />
              <Social href="#" Icon={Video}         label="YouTube" />
            </div>
          </div>

          {/* Customer */}
          <Column title="Customer" items={[
            { label: "About us",      href: "/about" },
            { label: "Blog",          href: "/blog" },
            { label: "Customer support", href: "/help" },
            { label: "Track order",   href: "/orders" },
            { label: "Returns & refunds", href: "/refunds" },
            { label: "FAQ",           href: "/faq" },
          ]} />

          {/* Partners */}
          <Column title="Partners" items={[
            { label: "Vendor registration",   href: "/register?role=vendor" },
            { label: "Delivery partner",      href: "/register?role=driver" },
            { label: "Affiliate program",     href: "/affiliate" },
            { label: "Sell on SPRITHI",       href: "/register?role=vendor" },
            { label: "Vendor login",          href: "/vendor/login" },
          ]} />

          {/* Contact + apps */}
          <div>
            <p className="text-sm font-bold text-white">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li className="flex items-start gap-2"><Phone className="mt-0.5 h-3.5 w-3.5 text-[var(--mk-brand)]" /> <a href="tel:+919442025515" className="hover:text-white">+91 94420 25515</a></li>
              <li className="flex items-start gap-2"><Mail className="mt-0.5 h-3.5 w-3.5 text-[var(--mk-brand)]" /> <a href="mailto:sprithi@gmail.com" className="hover:text-white">sprithi@gmail.com</a></li>
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 text-[var(--mk-brand)]" /> SPRITHI DIGITAL MART PRIVATE LIMITED, Kottaimetu, Villianur, Pondicherry 605110</li>
            </ul>

            <p className="mt-5 text-sm font-bold text-white">Download the app</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row lg:flex-col">
              <a href="#" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs hover:border-[var(--mk-brand)]">
                <Smartphone className="h-4 w-4" />
                <span>
                  <span className="block text-[9px] uppercase tracking-wider text-white/50">Get it on</span>
                  <span className="block font-semibold">Google Play</span>
                </span>
              </a>
              <a href="#" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs hover:border-[var(--mk-brand)]">
                <Smartphone className="h-4 w-4" />
                <span>
                  <span className="block text-[9px] uppercase tracking-wider text-white/50">Download on</span>
                  <span className="block font-semibold">App Store</span>
                </span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/50">
          <p>© {new Date().getFullYear()} SPRITHI Digital Mart · A wallet-powered marketplace</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/cookies" className="hover:text-white">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Column({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="text-sm font-bold text-white">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-white/70">
        {items.map((i) => (
          <li key={i.label}><Link href={i.href} className="hover:text-white">{i.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

function Social({ href, Icon, label }: { href: string; Icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <a href={href} aria-label={label} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 transition-colors hover:border-[var(--mk-brand)] hover:bg-[var(--mk-brand)]">
      <Icon className="h-4 w-4" />
    </a>
  );
}
