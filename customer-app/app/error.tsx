"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A static export changes its chunk hashes on every deploy. A browser holding a
 * cached page then fails to lazy-load an old chunk ("Loading chunk N failed").
 * Detect that and hard-reload once to pull the fresh HTML + chunks, instead of
 * showing the scary error screen.
 */
function isChunkError(err?: Error): boolean {
  const m = `${err?.name ?? ""} ${err?.message ?? ""}`;
  return (
    /ChunkLoadError/i.test(m) ||
    /Loading chunk [\w-]+ failed/i.test(m) ||
    /Loading CSS chunk/i.test(m) ||
    /Failed to fetch dynamically imported module/i.test(m) ||
    /error loading dynamically imported module/i.test(m)
  );
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Reload at most once per 10s so a genuinely-missing chunk can't loop forever.
  const RELOAD_KEY = "epey.chunkReloadAt";
  const recentlyReloaded =
    typeof window !== "undefined" && Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) || "0") < 10000;
  const willReload = isChunkError(error) && !recentlyReloaded;

  useEffect(() => {
    console.error("App error:", error);
    if (willReload && typeof window !== "undefined") {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    }
  }, [error, willReload]);

  if (willReload) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand/5 to-background p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Updating to the latest version…
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand/5 to-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-3 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
          <Button onClick={reset} className="w-full gap-1 bg-brand hover:bg-brand-deep">
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
