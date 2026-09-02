import {
  clearSession,
  getAccessToken,
  getOrgId,
  getRefreshToken,
  setSession,
} from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function parseError(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (typeof json.detail === "string") return json.detail;
    if (Array.isArray(json.detail)) {
      return json.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
    }
    return text || res.statusText;
  } catch {
    return text || res.statusText;
  }
}

let refreshPromise = null;

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("Not authenticated");
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) {
        clearSession();
        throw new Error("Session expired");
      }
      const data = await res.json();
      setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        org_id: getOrgId(),
      });
      return data.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function apiFetch(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const orgId = getOrgId();
  if (orgId) headers.set("X-Org-Id", orgId);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: "no-store" });

  if (res.status === 401) {
    if (retry && getRefreshToken()) {
      try {
        await refreshAccessToken();
        return apiFetch(path, options, false);
      } catch {
        clearSession();
        if (typeof window !== "undefined") window.location.assign("/login");
        throw new Error("Session expired");
      }
    }
    clearSession();
    if (typeof window !== "undefined" && !path.startsWith("/api/v1/auth/login")) {
      window.location.assign("/login");
    }
    throw new Error(await parseError(res));
  }

  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  if (res.status === 204) return undefined;
  return res.json();
}

export async function register(payload) {
  const data = await apiFetch("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  }, false);
  setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  return data;
}

export async function login(email, password) {
  const data = await apiFetch(
    "/api/v1/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false
  );
  setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  return data;
}

export async function logout() {
  const refresh = getRefreshToken();
  try {
    if (refresh) {
      await apiFetch(
        "/api/v1/auth/logout",
        { method: "POST", body: JSON.stringify({ refresh_token: refresh }) },
        false
      );
    }
  } finally {
    clearSession();
  }
}

export async function fetchMe() {
  const me = await apiFetch("/api/v1/auth/me");
  if (me.memberships?.length && !getOrgId()) {
    setSession({ org_id: me.memberships[0].organization_id });
  }
  return me;
}

export async function forgotPassword(email) {
  return apiFetch(
    "/api/v1/auth/forgot-password",
    { method: "POST", body: JSON.stringify({ email }) },
    false
  );
}

export async function resetPassword(token, new_password) {
  return apiFetch(
    "/api/v1/auth/reset-password",
    { method: "POST", body: JSON.stringify({ token, new_password }) },
    false
  );
}

export async function verifyEmail(token) {
  return apiFetch(
    "/api/v1/auth/verify-email",
    { method: "POST", body: JSON.stringify({ token }) },
    false
  );
}

export async function resendVerification(email) {
  return apiFetch(
    "/api/v1/auth/resend-verification",
    { method: "POST", body: JSON.stringify({ email }) },
    false
  );
}

export async function changePassword(current_password, new_password) {
  return apiFetch("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
  });
}

export async function listPacks() {
  return apiFetch("/api/v1/packs");
}

export async function getPack(id) {
  return apiFetch(`/api/v1/packs/${id}`);
}

export async function uploadPack(file, domain = "electronics") {
  const body = new FormData();
  body.append("file", file);
  return apiFetch(`/api/v1/packs?domain=${encodeURIComponent(domain)}`, {
    method: "POST",
    body,
  });
}

export async function processPackSync(id) {
  return apiFetch(`/api/v1/packs/${id}/process-sync`, { method: "POST" });
}

export async function approvePack(id) {
  return apiFetch(`/api/v1/packs/${id}/approve`, {
    method: "POST",
    body: "{}",
  });
}

export async function attestPack(id) {
  return apiFetch(`/api/v1/packs/${id}/attest`, { method: "POST" });
}
