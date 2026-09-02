"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell, Field } from "@/components/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchMe, register } from "@/lib/api";
import { setSession } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    organization_name: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        organization_name: form.organization_name.trim(),
        password: form.password,
      });
      const me = await fetchMe();
      if (me.memberships?.[0]) {
        setSession({ org_id: me.memberships[0].organization_id });
      }
      router.replace("/");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Register your organization as owner"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Full name" id="full_name">
          <Input
            id="full_name"
            required
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
          />
        </Field>
        <Field label="Work email" id="email">
          <Input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Organization name" id="organization_name">
          <Input
            id="organization_name"
            required
            value={form.organization_name}
            onChange={(e) => set("organization_name", e.target.value)}
          />
        </Field>
        <Field label="Password" id="password">
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Min 8 chars with upper, lower, and a digit</p>
        </Field>
        <Field label="Confirm password" id="confirm">
          <Input
            id="confirm"
            type="password"
            required
            value={form.confirm}
            onChange={(e) => set("confirm", e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          By creating an account you agree to use TradeDoc for authorized trade-document processing only.
        </p>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating…" : "Create organization"}
        </Button>
      </form>
    </AuthShell>
  );
}
