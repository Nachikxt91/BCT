"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { approvePack, attestPack, getPack, processPackSync } from "@/lib/api";

function CaseDetailInner({ user }) {
  const params = useParams();
  const [pack, setPack] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setPack(await getPack(params.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when route id changes
  }, [params.id]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      if (action === "process") await processPackSync(params.id);
      if (action === "approve") await approvePack(params.id);
      if (action === "attest") await attestPack(params.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!pack && !error) {
    return (
      <AppShell active="/" user={user}>
        <p className="text-sm text-muted-foreground">Loading case…</p>
      </AppShell>
    );
  }

  if (error && !pack) {
    return (
      <AppShell active="/" user={user}>
        <Alert variant="destructive">{error}</Alert>
      </AppShell>
    );
  }

  if (!pack) return null;

  const reviewFields = pack.fields.filter((f) => f.needs_review);

  return (
    <AppShell active="/" user={user}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Case</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{pack.filename}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={pack.status} />
            <span className="text-xs text-muted-foreground">{pack.page_count} pages</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void run("process")}>
            Run OCR
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void run("approve")}>
            Approve
          </Button>
          <Button disabled={busy} onClick={() => void run("attest")}>
            Attest on-chain
          </Button>
        </div>
      </div>

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
              <p className="text-sm text-muted-foreground">No fields yet — run OCR.</p>
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
            <CardDescription>OCR preview per page</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function CaseDetailPage() {
  return <AuthGuard>{(user) => <CaseDetailInner user={user} />}</AuthGuard>;
}
