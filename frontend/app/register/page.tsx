import { Suspense } from "react";
import AuthForm from "../components/AuthForm";

export const metadata = { title: "Create an account | ComfTalk" };

export default function RegisterPage() {
  return <Suspense fallback={<p className="page-container text-center text-ui-muted" role="status">Loading registration…</p>}><AuthForm mode="register" /></Suspense>;
}
