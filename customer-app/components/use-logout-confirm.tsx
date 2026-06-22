"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/auth";

/**
 * Shared "are you sure?" gate for logging out. Returns a `requestLogout`
 * trigger (open the confirm) and a `logoutDialog` element to render once in the
 * component. Confirming runs logout → success toast → redirect to /login.
 *
 * Use it at every logout entry point (profile, header, side-nav) so the
 * confirmation and the post-logout message stay consistent.
 */
export function useLogoutConfirm() {
  const router = useRouter();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await logout();
      toast.success("Logged out successfully");
      router.replace("/login");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const logoutDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton className="max-w-[320px]">
        <DialogHeader className="items-center gap-2.5 pt-2 text-center sm:text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white">
            <LogOut className="h-7 w-7" />
          </span>
          <DialogTitle className="text-center text-lg font-bold">Log out?</DialogTitle>
          <DialogDescription className="text-center">
            You&apos;ll need to sign in again to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <Button
            onClick={() => void confirm()}
            disabled={busy}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {busy ? "Logging out…" : "Yes"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            No
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { requestLogout: () => setOpen(true), logoutDialog };
}
