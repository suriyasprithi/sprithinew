import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand/5 to-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-3 p-6 text-center">
          <p className="text-5xl font-bold text-brand">404</p>
          <h1 className="text-lg font-semibold">Page not found</h1>
          <Link href="/dashboard"><Button className="w-full bg-brand hover:bg-brand-deep">Go home</Button></Link>
        </CardContent>
      </Card>
    </main>
  );
}
