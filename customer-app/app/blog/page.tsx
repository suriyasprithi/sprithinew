"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { TopInfoBar } from "@/components/marketplace/top-info-bar";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { FloatingActions } from "@/components/marketplace/floating-actions";
import { MarketplaceBottomNav } from "@/components/marketplace/mobile-bottom-nav";
import { api, apiErrorMessage } from "@/lib/api";

type BlogPost = {
  id: number | string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  published_at: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get("/public/blog");
        setPosts((r.data.data?.items ?? []) as BlogPost[]);
      } catch (err) {
        toast.error(apiErrorMessage(err, "Couldn't load blog"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="marketplace-theme min-h-screen pb-24 md:pb-0">
      <TopInfoBar />
      <MarketplaceHeader />

      <section className="mx-auto max-w-5xl px-4 pt-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">From the team</p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">SPRITHI Blog</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--mk-text-muted)]">
          Stories, vendor spotlights, and updates from your local marketplace.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-12 pt-6">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)]">
                <div className="aspect-[16/9] bg-[var(--mk-surface-2)] shimmer" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-1/3 rounded bg-[var(--mk-surface-2)] shimmer" />
                  <div className="h-5 w-4/5 rounded bg-[var(--mk-surface-2)] shimmer" />
                  <div className="h-3 w-full rounded bg-[var(--mk-surface-2)] shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--mk-border)] bg-[var(--mk-surface)] p-12 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-[var(--mk-brand)]" />
            <p className="text-sm font-semibold">No posts yet</p>
            <p className="mt-1 text-xs text-[var(--mk-text-muted)]">Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/blog/post?slug=${encodeURIComponent(p.slug)}`}
                className="group overflow-hidden rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--mk-shadow-md)]"
              >
                <div className="aspect-[16/9] overflow-hidden bg-[var(--mk-surface-2)]">
                  {p.cover_image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.cover_image} alt={p.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--mk-brand)] to-[var(--mk-brand-deep)] text-white">
                      <Sparkles className="h-10 w-10 opacity-70" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  {p.published_at && (
                    <p className="flex items-center gap-1 text-[11px] text-[var(--mk-text-muted)]">
                      <Calendar className="h-3 w-3" /> {formatDate(p.published_at)}
                    </p>
                  )}
                  <h2 className="mt-1 line-clamp-2 text-lg font-bold leading-snug group-hover:text-[var(--mk-brand-deep)]">
                    {p.title}
                  </h2>
                  {p.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm text-[var(--mk-text-muted)]">{p.excerpt}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <MarketplaceFooter />
      <FloatingActions />
      <MarketplaceBottomNav />
    </div>
  );
}
