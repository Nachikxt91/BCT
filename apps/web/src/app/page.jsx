"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listPacks } from "@/lib/api";
import { clearSession, isAuthenticated } from "@/lib/auth";

function CasesInner({ user }) {
  const router = useRouter();
  const [packs, setPacks] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <AppShell active="/" user={user}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Workbench</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Document cases</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload LC presentation packs, run OCR, review fields, attest hashes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button asChild>
            <Link href="/upload">
              <Upload className="h-4 w-4" /> Upload pack
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cases</CardTitle>
          <CardDescription>Domain locked to electronics for MVP</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <Alert variant="warning">{error}</Alert>}
          {!loading && !error && packs.length === 0 && (
            <p className="text-sm text-muted-foreground">No packs yet. Upload a PDF or image to begin.</p>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {packs.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/cases/${p.id}`} className="font-medium text-primary hover:underline">
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
                  </TableRow>
                ))}
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
