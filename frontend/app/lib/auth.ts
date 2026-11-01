export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return "/dashboard";
  const pathname = value.split(/[?#]/)[0].replace(/\/+$/, "");
  return pathname === "/login" || pathname === "/register" ? "/dashboard" : value;
}

export function loginHref(returnTo: string): string {
  return `/login?next=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
