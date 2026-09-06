"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function InfoTip({ title, children, side = "top", className, align = "start" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          aria-label={title ? `About ${title}` : "More information"}
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-80 text-sm">
        {title ? <p className="mb-1.5 font-semibold text-foreground">{title}</p> : null}
        <div className="space-y-2 text-muted-foreground leading-relaxed">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export function PageHeading({ eyebrow, title, description, infoTitle, info, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
        ) : null}
        <div className="mt-1 flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {info ? <InfoTip title={infoTitle || title}>{info}</InfoTip> : null}
        </div>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
