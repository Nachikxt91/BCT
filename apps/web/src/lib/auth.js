const ACCESS_KEY = "tradedoc_access";
const REFRESH_KEY = "tradedoc_refresh";
const ORG_KEY = "tradedoc_org";

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getOrgId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ORG_KEY);
}

export function setSession({ access_token, refresh_token, org_id }) {
  if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  if (org_id) localStorage.setItem(ORG_KEY, org_id);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ORG_KEY);
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}
