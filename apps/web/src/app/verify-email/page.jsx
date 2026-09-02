"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { verifyEmail } from "@/lib/api";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("pending");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setStatus("error");
        setMessage("Missing verification token");
        return;
      }
      try {
        const res = await verifyEmail(token);
        if (!cancelled) {
          setStatus("ok");
          setMessage(res.message || "Email verified");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setMessage(err.message || "Verification failed");
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthShell title="Email verification" subtitle="Confirming your TradeDoc account">
      <div className="space-y-4 text-sm">
        {status === "pending" ? (
          <p className="text-muted-foreground">{message}</p>
        ) : (
          <Alert variant={status === "ok" ? "success" : "destructive"}>{message}</Alert>
        )}
        <Button asChild className="w-full">
          <Link href="/login">Continue to sign in</Link>
        </Button>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
