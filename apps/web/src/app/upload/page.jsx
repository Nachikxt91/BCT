"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { InfoTip, PageHeading } from "@/components/info-tip";
import { PipelineVisual } from "@/components/pipeline-visual";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { processPack, uploadPack } from "@/lib/api";

function UploadInner({ user }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [autoProcess, setAutoProcess] = useState(true);

  async function onSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const pack = await uploadPack(file, "electronics");
      setMessage(`Uploaded ${pack.filename} (${pack.sha256.slice(0, 12)}…)`);
      if (autoProcess) {
        setMessage("Uploaded — OCR queued. Tracking progress on the case…");
        try {
          await processPack(pack.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!/already processing/i.test(msg)) throw err;
        }
        router.push(`/cases/${pack.id}`);
      } else {
        router.push(`/cases/${pack.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell active="/upload" user={user}>
      <PageHeading
        eyebrow="Ingest"
        title="Upload document pack"
        description="PDF or image. Domain: electronics."
        infoTitle="Where do I add my PDF?"
        info={
          <>
            <p>
              Use the dashed drop zone below — click it or drag a file in. Supported: PDF, PNG, JPG
              (and TIFF/WebP), up to 50MB.
            </p>
            <p>
              Your sample file{" "}
              <em>Documentation Examples-EU3-small (1).pdf</em> from Downloads is a good multi-page
              OCR test (mostly scanned pages).
            </p>
          </>
        }
      />

      <div className="mb-6 max-w-4xl">
        <PipelineVisual activeStep="ocr" />
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>New pack</CardTitle>
            <InfoTip title="Integrity on ingest">
              <p>
                On upload we compute a SHA-256 fingerprint of the exact file bytes. Private document
                content is stored in your org workspace — not written to the blockchain.
              </p>
            </InfoTip>
          </div>
          <CardDescription>Files are hashed (SHA-256) on ingest. PII stays off-chain.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-input bg-muted/30 px-6 py-10 text-center transition-colors hover:bg-muted/60">
              <span className="text-sm font-medium text-foreground">
                {file ? file.name : "Drop or choose a file"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Click here · PDF, PNG, JPG up to 50MB
              </span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="flex items-center gap-2">
              <input
                id="autoProcess"
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                checked={autoProcess}
                onChange={(e) => setAutoProcess(e.target.checked)}
              />
              <Label htmlFor="autoProcess">Run OCR immediately after upload</Label>
              <InfoTip title="Auto OCR">
                <p>
                  When enabled, the pack is processed right after upload (may take longer for large
                  scanned PDFs). Turn this off to upload only — then start OCR from the Cases list
                  with <strong>Run OCR</strong>.
                </p>
              </InfoTip>
            </div>

            {message && <Alert variant="success">{message}</Alert>}
            {error && <Alert variant="destructive">{error}</Alert>}

            <Button type="submit" disabled={!file || busy} className="w-full">
              {busy ? "Working…" : "Upload pack"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}

export default function UploadPage() {
  return <AuthGuard>{(user) => <UploadInner user={user} />}</AuthGuard>;
}
