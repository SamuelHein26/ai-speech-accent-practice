import { Suspense } from "react";
import AuthForm from "../components/AuthForm";

export const metadata = { title: "Log in | ComfTalk" };

export default function LoginPage() {
  return <Suspense fallback={<p className="page-container text-center text-ui-muted" role="status">Loading login…</p>}><AuthForm mode="login" /></Suspense>;
}
