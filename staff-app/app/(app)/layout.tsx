"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/stores/auth";
import { isRouteAllowed } from "@/lib/role-menu";
import { initPushHandlers } from "@/lib/push";

function RoleRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { user, isHydrated } = useAuth();

  useEffect(() => {
    if (!isHydrated || !user) return;
    if (!isRouteAllowed(user.role, pathname)) {
      router.replace("/dashboard");
    }
  }, [isHydrated, user, pathname, router]);

  return <>{children}</>;
}

export default function StaffShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    initPushHandlers((route) => router.push(route));
  }, [router]);

  return (
    <AuthGuard>
      <TooltipProvider delay={150}>
        <RoleRouteGuard>
          <div className="flex min-h-screen bg-background">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="flex-1">{children}</main>
            </div>
          </div>
        </RoleRouteGuard>
      </TooltipProvider>
    </AuthGuard>
  );
}
