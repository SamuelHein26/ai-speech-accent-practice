import type { ReactNode } from "react";
import AuthGuard from "../components/AuthGuard";

export default function AccentLayout({ children }: { children: ReactNode }) {
  return <AuthGuard verifyOnEntry>{children}</AuthGuard>;
}
