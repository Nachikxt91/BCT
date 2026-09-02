"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPacks } from "@/lib/api";

function AuditInner({ user }) {
  const [packs, setPacks] = useState([]);

  useEffect(() => {
    void listPacks()
      .then(setPacks)
      .catch(() => setPacks([]));
  }, []);

  const attested = packs.filter((p) => p.attestation_tx);

  return (
    <AppShell active="/audit" user={user}>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Integrity</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Audit trail</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          On-chain / mock attestation receipts (hashes only).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Attested packs</CardTitle>
          <CardDescription>{attested.length} receipt(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {attested.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No attestations yet. Approve a pack and click Attest.
            </p>
          )}
          {attested.map((p) => (
            <div key={p.id} className="rounded-lg border bg-card px-3 py-3 text-sm">
              <p className="font-medium text-foreground">{p.filename}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{p.attestation_tx}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}

export default function AuditPage() {
  return <AuthGuard>{(user) => <AuditInner user={user} />}</AuthGuard>;
}
