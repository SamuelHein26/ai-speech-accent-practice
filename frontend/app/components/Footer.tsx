import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full bg-ui-surface border-t border-ui-border py-4">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <div className="flex space-x-6 text-ui-text text-xs font-medium">
          <Link
            href="/about"
            className="hover:text-ui-accent transition"
          >
            About
          </Link>
          <Link href="/privacy" className="hover:text-ui-accent transition">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-ui-accent transition">
            Terms of Service
          </Link>
        </div>

        <p className="text-xs text-ui-muted">
          © {new Date().getFullYear()} ComfTalk — AI Speech & Accent Practice. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
