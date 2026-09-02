"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 15% 0%, hsl(var(--primary) / 0.12), transparent 55%), radial-gradient(ellipse 60% 45% at 100% 100%, hsl(var(--primary) / 0.08), transparent 50%), hsl(var(--background))",
        }}
      />
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <Link href="/login" className="inline-block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              TradeDoc OCR
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          </Link>
          {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <Card>
          <CardContent className="p-6 pt-6">{children}</CardContent>
        </Card>
        {footer ? <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, id, error, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
