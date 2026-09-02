"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

/** If already signed in, skip login form. */
export function useRedirectIfAuthed(to = "/") {
  const router = useRouter();
  useEffect(() => {
    if (isAuthenticated()) router.replace(to);
  }, [router, to]);
}
