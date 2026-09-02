"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { processPackSync, uploadPack } from "@/lib/api";

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
        setMessage("Uploaded — running OCR pipeline…");
        const detail = await processPackSync(pack.id);
        setMessage(`OCR complete — status ${detail.status}`);
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
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Ingest</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Upload document pack</h2>
        <p className="mt-1 text-sm text-muted-foreground">PDF or image. Domain: electronics.</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>New pack</CardTitle>
          <CardDescription>Files are hashed (SHA-256) on ingest. PII stays off-chain.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-input bg-muted/30 px-6 py-10 text-center transition-colors hover:bg-muted/60">
              <span className="text-sm font-medium text-foreground">
                {file ? file.name : "Drop or choose a file"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">PDF, PNG, JPG up to 50MB</span>
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
