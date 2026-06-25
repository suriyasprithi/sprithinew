"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Phone, MapPin, Smartphone } from "lucide-react";
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
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
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
              <Social href="/coming-soon" Icon={FacebookIcon}  label="Facebook" />
              <Social href="/coming-soon" Icon={InstagramIcon} label="Instagram" />
              <Social href="/coming-soon" Icon={XIcon}         label="X (Twitter)" />
              <Social href="/coming-soon" Icon={YouTubeIcon}   label="YouTube" />
              <Social href="/coming-soon" Icon={WhatsAppIcon}  label="WhatsApp" />
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
              <Link href="/coming-soon" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs hover:border-[var(--mk-brand)]">
                <Smartphone className="h-4 w-4" />
                <span>
                  <span className="block text-[9px] uppercase tracking-wider text-white/50">Get it on</span>
                  <span className="block font-semibold">Google Play</span>
                </span>
              </Link>
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
    <Link href={href} aria-label={label} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 transition-colors hover:border-[var(--mk-brand)] hover:bg-[var(--mk-brand)]">
      <Icon className="h-4 w-4" />
    </Link>
  );
}

// Brand glyphs (simple-icons single paths) — lucide dropped brand icons, so we
// inline the SVGs to avoid an extra dependency. fill=currentColor inherits the
// hover colour from the Social wrapper.
function BrandSvg({ className, d }: { className?: string; d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}

const FacebookIcon = (p: { className?: string }) => (
  <BrandSvg className={p.className} d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
);
const InstagramIcon = (p: { className?: string }) => (
  <BrandSvg className={p.className} d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
);
const XIcon = (p: { className?: string }) => (
  <BrandSvg className={p.className} d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
);
const YouTubeIcon = (p: { className?: string }) => (
  <BrandSvg className={p.className} d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
);
const WhatsAppIcon = (p: { className?: string }) => (
  <BrandSvg className={p.className} d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
);
