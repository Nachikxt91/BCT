"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, RefreshCw, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { approvePack, attestPack, listPacks, processPack } from "@/lib/api";
import { clearSession, isAuthenticated } from "@/lib/auth";
import { InfoTip, PageHeading } from "@/components/info-tip";
import { PipelineVisual } from "@/components/pipeline-visual";

const PROCESSING = new Set(["queued", "preprocessing", "ocr", "extracting"]);

/** Next pipeline action for a pack row, or null when nothing to advance. */
function nextStepFor(status) {
  if (PROCESSING.has(status)) {
    return { kind: "busy", label: "Processing…" };
  }
  if (status === "uploaded" || status === "failed") {
    return { kind: "process", label: status === "failed" ? "Retry OCR" : "Run OCR" };
  }
  if (status === "needs_review") {
    return { kind: "approve", label: "Approve" };
  }
  if (status === "approved") {
    return { kind: "attest", label: "Attest" };
  }
  return null;
}

function CasesInner({ user }) {
  const router = useRouter();
  const [packs, setPacks] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPacks(await listPacks());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load packs";
      if (/not authenticated|session expired|invalid or expired/i.test(msg)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setError(
        msg.includes("Failed to fetch")
          ? "Cannot reach API on :8000. Start the backend, then refresh."
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function runNext(pack) {
    const step = nextStepFor(pack.status);
    if (!step || step.kind === "busy") return;

    setBusyId(pack.id);
    setError(null);
    try {
      if (step.kind === "process") {
        try {
          await processPack(pack.id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!/already processing/i.test(msg)) throw e;
        }
        router.push(`/cases/${pack.id}`);
        return;
      }
      if (step.kind === "approve") {
        await approvePack(pack.id);
        await load();
        return;
      }
      if (step.kind === "attest") {
        await attestPack(pack.id);
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell active="/" user={user}>
      <PageHeading
        eyebrow="Workbench"
        title="Document cases"
        description="Upload LC presentation packs, run OCR, review fields, attest hashes."
        infoTitle="What is a case?"
        info={
          <>
            <p>
              A case is one uploaded trade document pack (PDF or image set) owned by your
              organization. Status moves through OCR → extract → review → attest.
            </p>
            <p>
              After upload, use <strong>Run OCR</strong> in the Actions column to start the next
              pipeline step, or open the filename for the full review desk.
            </p>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button asChild>
              <Link href="/upload">
                <Upload className="h-4 w-4" /> Upload pack
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6">
        <PipelineVisual />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Cases</CardTitle>
            <InfoTip title="Case list">
              <p>
                Shows only packs for your active organization. SHA-256 is the file fingerprint
                computed at upload — used later for attestation.
              </p>
              <p>
                <strong>Next step</strong> advances the pack one stage (OCR → approve → attest)
                without leaving this list first.
              </p>
            </InfoTip>
          </div>
          <CardDescription>Domain locked to electronics for MVP</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && (
            <div className="mb-4">
              <Alert variant="warning">{error}</Alert>
            </div>
          )}
          {!loading && packs.length === 0 && !error && (
            <div className="rounded-lg border border-dashed border-input bg-muted/20 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No packs yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Go to{" "}
                <Link href="/upload" className="font-medium text-primary hover:underline">
                  Upload pack
                </Link>
                , then choose your PDF (for example the Documentation Examples file in Downloads).
              </p>
            </div>
          )}
          {packs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>SHA-256</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="text-right">Next step</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packs.map((p) => {
                  const step = nextStepFor(p.status);
                  const rowBusy = busyId === p.id;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          href={`/cases/${p.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {p.filename}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">{p.domain}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.page_count}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {p.sha256.slice(0, 12)}…
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {step ? (
                          <Button
                            size="sm"
                            variant={step.kind === "process" ? "default" : "secondary"}
                            disabled={rowBusy || busyId != null || step.kind === "busy"}
                            onClick={() => void runNext(p)}
                          >
                            {rowBusy ? "Working…" : step.label}
                            {!rowBusy && step.kind !== "busy" ? (
                              <ArrowRight className="h-3.5 w-3.5" />
                            ) : null}
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/cases/${p.id}`}>Open</Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

export default function CasesPage() {
  const router = useRouter();
  const [boot, setBoot] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      clearSession();
      router.replace("/login");
      return;
    }
    setBoot(true);
  }, [router]);

  if (!boot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
  }

  return <AuthGuard>{(user) => <CasesInner user={user} />}</AuthGuard>;
}
