"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SideNav } from "@/components/layout/side-nav";
import { initPushHandlers } from "@/lib/push";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    initPushHandlers((route) => router.push(route));
  }, [router]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <SideNav />
        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>
        <BottomNav />
      </div>
    </AuthGuard>
  );
}
