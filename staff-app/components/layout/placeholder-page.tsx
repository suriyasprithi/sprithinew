"use client";

import { Sparkles, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MobileHeader } from "./mobile-nav";

export function PlaceholderPage({
  title,
  icon: Icon = Sparkles,
  description,
}: {
  title: string;
  icon?: LucideIcon;
  description?: string;
}) {
  return (
    <>
      <MobileHeader title={title} />
      <section className="mx-auto max-w-5xl space-y-4 p-4 md:p-8">
        <h2 className="hidden text-2xl font-semibold md:block">{title}</h2>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
            <Icon className="h-10 w-10 text-brand" />
            <p className="font-medium">{title} coming soon</p>
            <p className="text-sm">
              {description ?? "This screen will be built in a later phase."}
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
