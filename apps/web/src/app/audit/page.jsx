"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPacks } from "@/lib/api";
import { PageHeading } from "@/components/info-tip";

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
      <PageHeading
        eyebrow="Integrity"
        title="Audit trail"
        description="On-chain / mock attestation receipts (hashes only)."
        infoTitle="What is an attestation receipt?"
        info={
          <>
            <p>
              After approval, Attest records fingerprints of the original file and the extraction
              result. That proves integrity later without exposing private document contents.
            </p>
            <p>
              If blockchain is not configured, the API returns a deterministic mock transaction id
              so demos still complete end-to-end.
            </p>
          </>
        }
      />
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
