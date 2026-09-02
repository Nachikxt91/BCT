"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { changePassword } from "@/lib/api";

function SettingsInner({ user }) {
  const membership = user?.memberships?.[0];
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onChangePassword(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (next !== confirm) {
      setErr("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await changePassword(current, next);
      setMsg(res.message || "Password changed");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (ex) {
      setErr(ex.message || "Failed to change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell active="/settings" user={user}>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Admin</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Account security, organization, and platform configuration.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed-in identity and organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Name:</span> {user.full_name}
            </p>
            <p>
              <span className="font-medium text-foreground">Email:</span> {user.email}
            </p>
            <p>
              <span className="font-medium text-foreground">Verified:</span>{" "}
              {user.email_verified ? "Yes" : "No — check API logs for verify link"}
            </p>
            {membership ? (
              <>
                <Separator className="my-3" />
                <p>
                  <span className="font-medium text-foreground">Organization:</span>{" "}
                  {membership.organization_name}
                </p>
                <p>
                  <span className="font-medium text-foreground">Role:</span> {membership.role}
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Min 8 chars with upper, lower, and a digit</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onChangePassword}>
              <div className="space-y-2">
                <Label htmlFor="current">Current password</Label>
                <Input
                  id="current"
                  type="password"
                  required
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next">New password</Label>
                <Input
                  id="next"
                  type="password"
                  required
                  minLength={8}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {msg ? <Alert variant="success">{msg}</Alert> : null}
              {err ? <Alert variant="destructive">{err}</Alert> : null}
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model routing</CardTitle>
            <CardDescription>Configured via API environment variables</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Classify:</span> Groq llama-3.1-8b-instant
            </p>
            <p>
              <span className="font-medium text-foreground">Extract:</span> Groq gpt-oss-20b
            </p>
            <p>
              <span className="font-medium text-foreground">Vision primary:</span> Gemini Flash
            </p>
            <p>
              <span className="font-medium text-foreground">Vision fallback:</span> Groq Qwen vision
            </p>
            <p>
              <span className="font-medium text-foreground">Classic OCR:</span> PaddleOCR → Tesseract →
              stub
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Blockchain</CardTitle>
            <CardDescription>DocumentAttestation — hashes only</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Without <code className="rounded bg-muted px-1 py-0.5 text-foreground">CHAIN_RPC_URL</code>{" "}
              the API returns a mock transaction id so demos work offline.
            </p>
            <p className="mt-2">
              Deploy: <code className="rounded bg-muted px-1 py-0.5 text-foreground">packages/contracts</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function SettingsPage() {
  return <AuthGuard>{(user) => <SettingsInner user={user} />}</AuthGuard>;
}
