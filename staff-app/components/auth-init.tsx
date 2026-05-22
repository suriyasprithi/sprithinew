"use client";

import { useEffect } from "react";
import { useAuth } from "@/stores/auth";
import { hydrateStorage } from "@/lib/storage";

export function AuthInit() {
  const hydrate = useAuth((s) => s.hydrate);
  useEffect(() => {
    (async () => {
      await hydrateStorage();
      await hydrate();
    })();
  }, [hydrate]);
  return null;
}
