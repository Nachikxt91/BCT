"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { approvePack, attestPack, getPack, processPack } from "@/lib/api";
import { InfoTip } from "@/components/info-tip";
import { PipelineVisual } from "@/components/pipeline-visual";

const PROCESSING = new Set(["queued", "preprocessing", "ocr", "extracting"]);

function activeStepForStatus(status) {
  if (["uploaded", "queued", "preprocessing", "ocr"].includes(status)) return "ocr";
  if (status === "extracting") return "extract";
  if (status === "needs_review") return "review";
  if (status === "approved" || status === "attested") return "attest";
  return null;
}

function isProcessingStatus(status) {
  return PROCESSING.has(status);
}

function ProgressPanel({ pack }) {
  const total = pack.progress_total || pack.page_count || 0;
  const current = pack.progress_current || 0;
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null;
  const message = pack.progress_message || "Processing…";

  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{message}</p>
        {pct != null ? (
          <p className="text-xs font-medium tabular-nums text-muted-foreground">
            {current}/{total} · {pct}%
          </p>
        ) : (
          <p className="text-xs text-muted-foreground capitalize">{pack.status}</p>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct != null ? Math.max(pct, 4) : 12}%` }}
        />
      </div>
      {pack.pages?.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {pack.pages.length} page preview{pack.pages.length === 1 ? "" : "s"} ready so far
        </p>
      ) : null}
    </div>
  );
}

function BackToCases() {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 mb-3 h-8 px-2 text-muted-foreground" asChild>
      <Link href="/">
        <ArrowLeft className="h-4 w-4" />
        Back to cases
      </Link>
    </Button>
  );
}

function CaseDetailInner({ user }) {
  const params = useParams();
  const [pack, setPack] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load({ quiet = false } = {}) {
    try {
      const next = await getPack(params.id);
      setPack(next);
      if (!quiet) setError(null);
      return next;
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : "Failed to load");
      return null;
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when route id changes
  }, [params.id]);

  // Poll while pipeline is running so progress / pages update live.
  useEffect(() => {
    if (!pack || !isProcessingStatus(pack.status)) return undefined;
    const id = setInterval(() => {
      void load({ quiet: true });
    }, 1500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack?.id, pack?.status]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      if (action === "process") {
        try {
          await processPack(params.id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Already running — switch to live progress instead of a hard error.
          if (/already processing/i.test(msg)) {
            await load();
            return;
          }
          throw e;
        }
        await load();
        return;
      }
      if (action === "approve") await approvePack(params.id);
      if (action === "attest") await attestPack(params.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      await load({ quiet: true });
    } finally {
      setBusy(false);
    }
  }

  if (!pack && !error) {
    return (
      <AppShell active="/" user={user}>
        <BackToCases />
        <p className="text-sm text-muted-foreground">Loading case…</p>
      </AppShell>
    );
  }

  if (error && !pack) {
    return (
      <AppShell active="/" user={user}>
        <BackToCases />
        <Alert variant="destructive">{error}</Alert>
      </AppShell>
    );
  }

  if (!pack) return null;

  const reviewFields = pack.fields.filter((f) => f.needs_review);
  const processing = isProcessingStatus(pack.status);

  return (
    <AppShell active="/" user={user}>
      <BackToCases />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Case</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{pack.filename}</h2>
            <InfoTip title="Case review desk">
              <p>
                Review extracted fields and page OCR previews. Approve only after checking flagged
                items. Attest records integrity hashes — it does not publish the PDF.
              </p>
            </InfoTip>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={pack.status} />
            <span className="text-xs text-muted-foreground">{pack.page_count} pages</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" disabled={busy || processing} onClick={() => void run("process")}>
              {processing ? "Processing…" : "Run OCR"}
            </Button>
            <InfoTip title="Run OCR">
              <p>
                Queues OCR + classify + extract. Progress updates live (page-by-page). Large scanned
                PDFs may take several minutes when using vision OCR.
              </p>
            </InfoTip>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              disabled={busy || processing || !["needs_review", "approved"].includes(pack.status)}
              onClick={() => void run("approve")}
            >
              Approve
            </Button>
            <InfoTip title="Approve">
              <p>Requires reviewer role or higher. Marks the pack as human-validated.</p>
            </InfoTip>
          </div>
          <div className="flex items-center gap-1">
            <Button
              disabled={busy || processing || !["approved", "attested"].includes(pack.status)}
              onClick={() => void run("attest")}
            >
              Attest on-chain
            </Button>
            <InfoTip title="Attest">
              <p>
                Requires admin role or higher, and an approved pack. Writes document + result hashes
                (mock or blockchain).
              </p>
            </InfoTip>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <PipelineVisual activeStep={activeStepForStatus(pack.status)} />
      </div>

      {processing ? <ProgressPanel pack={pack} /> : null}

      {error && (
        <div className="mb-4">
          <Alert variant="destructive">{error}</Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Integrity</CardTitle>
            <CardDescription>Document and result hashes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div>
              <p className="font-medium text-foreground">Doc SHA-256</p>
              <p className="mt-1 break-all font-mono text-muted-foreground">{pack.sha256}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Result hash</p>
              <p className="mt-1 break-all font-mono text-muted-foreground">{pack.result_hash ?? "—"}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Attestation tx</p>
              <p className="mt-1 break-all font-mono text-muted-foreground">
                {pack.attestation_tx ?? "—"}
              </p>
            </div>
            {pack.error_message && <Alert variant="destructive">{pack.error_message}</Alert>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Extracted fields</CardTitle>
            <CardDescription>
              {reviewFields.length > 0
                ? `${reviewFields.length} field(s) flagged for review`
                : "No low-confidence flags"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pack.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {processing ? "Fields appear after extraction finishes…" : "No fields yet — run OCR."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Conf</TableHead>
                    <TableHead>Model</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pack.fields.map((f) => (
                    <TableRow
                      key={f.id}
                      className={f.needs_review ? "bg-warning/10 hover:bg-warning/15" : undefined}
                    >
                      <TableCell className="font-medium">{f.key}</TableCell>
                      <TableCell className="text-muted-foreground">{f.value ?? "—"}</TableCell>
                      <TableCell>{(f.confidence * 100).toFixed(0)}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.source_model}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Pages</CardTitle>
            <CardDescription>
              {processing
                ? `OCR preview · ${pack.pages.length} of ${pack.page_count || "?"} ready`
                : "OCR preview per page"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pack.pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {processing ? "Waiting for first page…" : "No pages yet — run OCR."}
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {pack.pages.map((p) => (
                  <div key={p.id} className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        Page {p.page_number} · {p.doc_type}
                      </span>
                      <span className="text-muted-foreground">
                        {p.ocr_engine} ·{" "}
                        {p.ocr_confidence != null ? `${(p.ocr_confidence * 100).toFixed(0)}%` : "—"}
                      </span>
                    </div>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                      {p.ocr_text_preview || "(no text)"}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function CaseDetailPage() {
  return <AuthGuard>{(user) => <CaseDetailInner user={user} />}</AuthGuard>;
}
