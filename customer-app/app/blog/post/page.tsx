"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Calendar, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { TopInfoBar } from "@/components/marketplace/top-info-bar";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { FloatingActions } from "@/components/marketplace/floating-actions";
import { MarketplaceBottomNav } from "@/components/marketplace/mobile-bottom-nav";
import { api, apiErrorMessage } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";

type BlogPost = {
  id: number | string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  content: string | null;
  published_at: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function BlogPostPage() {
  return (
    <Suspense fallback={
      <div className="marketplace-theme flex min-h-screen items-center justify-center text-sm text-[var(--mk-text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    }>
      <BlogPostInner />
    </Suspense>
  );
}

function BlogPostInner() {
  const sp = useSearchParams();
  const slug = sp?.get("slug") ?? "";
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setLoading(false); setNotFound(true); return; }
    void (async () => {
      try {
        const r = await api.get(`/public/blog/${encodeURIComponent(slug)}`);
        const p = r.data.data?.post as BlogPost | undefined;
        if (!p) { setNotFound(true); return; }
        setPost(p);
      } catch (err) {
        const e = err as { response?: { status?: number } };
        if (e?.response?.status === 404) { setNotFound(true); return; }
        toast.error(apiErrorMessage(err, "Couldn't load post"));
      } finally { setLoading(false); }
    })();
  }, [slug]);

  return (
    <div className="marketplace-theme min-h-screen pb-24 md:pb-0">
      <TopInfoBar />
      <MarketplaceHeader />

      <section className="mx-auto max-w-3xl px-4 pt-6">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--mk-text-muted)] hover:text-[var(--mk-brand)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All posts
        </Link>
      </section>

      {loading ? (
        <section className="mx-auto flex max-w-3xl items-center justify-center px-4 py-20 text-[var(--mk-text-muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading post…
        </section>
      ) : notFound || !post ? (
        <section className="mx-auto max-w-3xl px-4 py-16 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-[var(--mk-brand)]" />
          <h1 className="text-xl font-bold">Post not found</h1>
          <p className="mt-2 text-sm text-[var(--mk-text-muted)]">It may have been removed or the link is wrong.</p>
          <Link
            href="/blog"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--mk-brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--mk-brand-deep)]"
          >
            Browse blog
          </Link>
        </section>
      ) : (
        <article className="mx-auto max-w-3xl px-4 pb-16 pt-4">
          {post.cover_image && (
            <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface-2)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover_image} alt={post.title} className="aspect-[16/9] w-full object-cover" />
            </div>
          )}
          <header className="mb-6">
            {post.published_at && (
              <p className="flex items-center gap-1 text-xs text-[var(--mk-text-muted)]">
                <Calendar className="h-3 w-3" /> {formatDate(post.published_at)}
              </p>
            )}
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{post.title}</h1>
            {post.excerpt && (
              <p className="mt-3 text-base text-[var(--mk-text-soft)]">{post.excerpt}</p>
            )}
          </header>
          <div className="text-[var(--mk-text)]">
            {renderMarkdown(post.content ?? "")}
          </div>
        </article>
      )}

      <MarketplaceFooter />
      <FloatingActions />
      <MarketplaceBottomNav />
    </div>
  );
}
