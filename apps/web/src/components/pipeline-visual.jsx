"use client";

import {
  CheckCircle2,
  FileSearch,
  Fingerprint,
  ScanText,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/info-tip";

const STEPS = [
  {
    id: "ocr",
    label: "OCR",
    detail: "Read pages",
    icon: ScanText,
    help: "Classic OCR engines read each page. Low-confidence pages can fall back to AI vision (Gemini/Groq) when API keys are configured.",
  },
  {
    id: "extract",
    label: "Extract",
    detail: "Structure fields",
    icon: FileSearch,
    help: "The system classifies each page (invoice, BL, certificate, etc.) and extracts structured fields into a reviewable table.",
  },
  {
    id: "review",
    label: "Review",
    detail: "Human check",
    icon: CheckCircle2,
    help: "A reviewer validates flagged fields and approves the pack. Automation assists — it does not silently finalize trade decisions.",
  },
  {
    id: "attest",
    label: "Attest",
    detail: "Integrity hash",
    icon: Fingerprint,
    help: "Document and result fingerprints (SHA-256) are recorded for audit. On-chain when configured; otherwise a deterministic mock receipt for demos.",
  },
];

/**
 * @param {"full" | "compact"} variant
 * @param {string | null} activeStep - ocr | extract | review | attest
 */
export function PipelineVisual({ variant = "full", activeStep = null, className }) {
  if (variant === "compact") {
    return (
      <div className={cn("rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3", className)}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-sidebar-foreground">Processing pipeline</p>
          <InfoTip title="Operations pipeline" side="right">
            <p>
              Every trade pack moves through four controlled stages. Click any step icon on the main
              workbench for more detail.
            </p>
          </InfoTip>
        </div>
        <ol className="space-y-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.id} className="flex items-center gap-2 text-xs">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sidebar-primary/15 text-sidebar-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-sidebar-foreground">
                    {index + 1}. {step.label}
                  </span>
                  <span className="block truncate text-muted-foreground">{step.detail}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm md:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold tracking-tight">Document operations pipeline</p>
          <InfoTip title="Why this pipeline?">
            <p>
              Trade document handling needs both machine speed and human accountability. This stage
              model is the control path for every pack in your organization.
            </p>
            <p>
              Hashes protect integrity; private PDFs stay off-chain. Roles gate who can approve or
              attest.
            </p>
          </InfoTip>
        </div>
        <p className="text-xs text-muted-foreground">Controlled path · human-in-the-loop</p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = activeStep === step.id;
          return (
            <li
              key={step.id}
              className={cn(
                "relative rounded-lg border bg-background/60 p-3 transition-colors",
                isActive && "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
              )}
            >
              {index < STEPS.length - 1 ? (
                <span
                  className="pointer-events-none absolute -right-2 top-1/2 z-10 hidden h-px w-4 -translate-y-1/2 bg-border xl:block"
                  aria-hidden
                />
              ) : null}
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <InfoTip title={step.label} side="left">
                  <p>{step.help}</p>
                </InfoTip>
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Step {index + 1}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">{step.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
