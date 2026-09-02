"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, isAuthenticated } from "@/lib/auth";
import { fetchMe } from "@/lib/api";

export function AuthGuard({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isAuthenticated()) {
        clearSession();
        router.replace("/login");
        return;
      }
      try {
        const me = await fetchMe();
        if (cancelled) return;
        if (!me?.id) {
          clearSession();
          router.replace("/login");
          return;
        }
        setUser(me);
        setReady(true);
      } catch {
        if (cancelled) return;
        clearSession();
        router.replace("/login");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Checking session…
      </div>
    );
  }

  return typeof children === "function" ? children(user) : children;
}
