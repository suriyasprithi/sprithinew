import Link from "next/link";
import {
  ShoppingBasket, UtensilsCrossed, Pill, Scissors, Plane, Wrench, Home,
} from "lucide-react";

const SERVICES = [
  { label: "Grocery delivery",  desc: "Daily essentials in 10 min", icon: ShoppingBasket,  gradient: "from-orange-500 to-red-500"     },
  { label: "Food delivery",     desc: "From your favourite restaurants", icon: UtensilsCrossed, gradient: "from-rose-500 to-orange-500" },
  { label: "Pharmacy delivery", desc: "Prescriptions and OTC meds", icon: Pill,            gradient: "from-emerald-500 to-teal-500"   },
  { label: "Salon booking",     desc: "Hair, makeup, spa at home",  icon: Scissors,        gradient: "from-pink-500 to-fuchsia-500"   },
  { label: "Travel booking",    desc: "Buses, tickets and tours",   icon: Plane,           gradient: "from-sky-500 to-blue-500"       },
  { label: "Local services",    desc: "Plumber, electrician, more", icon: Wrench,          gradient: "from-amber-500 to-orange-500"   },
  { label: "Home services",     desc: "Cleaning, laundry, repairs", icon: Home,            gradient: "from-violet-500 to-purple-500"  },
];

export function ServicesSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Beyond products</p>
          <h2 className="text-xl font-bold tracking-tight md:text-2xl">Services marketplace</h2>
        </div>
        <Link href="/shop-public" className="text-sm font-semibold text-[var(--mk-brand)] hover:underline">
          See all →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {SERVICES.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href="/shop-public"
              className="group flex flex-col gap-2 rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--mk-brand)]/40 hover:shadow-[var(--mk-shadow-md)]"
            >
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient} text-white shadow-sm transition-transform group-hover:scale-105`}>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <p className="text-sm font-bold leading-tight">{s.label}</p>
              <p className="text-[11px] leading-snug text-[var(--mk-text-muted)]">{s.desc}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
