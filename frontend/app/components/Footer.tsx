import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full bg-ui-surface border-t border-ui-border py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <div className="flex space-x-6 text-ui-text text-sm font-medium">
          <Link
            href="/about"
            className="hover:text-ui-accent transition"
          >
            About
          </Link>
          <button 
            className="hover:text-ui-accent transition cursor-pointer"
          >
            Privacy Policy
          </button>
          <button
            className="hover:text-ui-accent transition cursor-pointer"
          >
            Terms of Service
          </button>
        </div>

        <p className="text-sm text-ui-muted">
          © {new Date().getFullYear()} ComfTalk — AI Speech & Accent Practice. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
