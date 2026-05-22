"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { menuFor } from "@/lib/role-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const items = menuFor(user?.role);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="group flex h-10 w-full max-w-md items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:bg-surface-2"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search pages, actions…</span>
            <kbd className="hidden items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        }
      />
      <DialogContent
        showCloseButton={false}
        className="top-1/3 max-w-lg translate-y-0 overflow-hidden p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>Search pages and quick actions.</DialogDescription>
        </DialogHeader>
        <Command className="rounded-xl">
          <CommandInput placeholder="Type a command or page…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Pages">
              {items.map((m) => {
                const Icon = m.icon;
                return (
                  <CommandItem key={m.href} onSelect={() => go(m.href)}>
                    <Icon className="h-4 w-4" />
                    <span>{m.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Quick">
              <CommandItem onSelect={() => go("/notifications")}>Notifications</CommandItem>
              <CommandItem onSelect={() => go("/profile")}>Profile</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
