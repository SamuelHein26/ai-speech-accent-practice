import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 py-8">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-center md:text-left space-y-4 md:space-y-0">
        <div className="flex space-x-6 text-gray-700 dark:text-gray-300 text-sm font-medium">
          <Link
            href="/about"
            className="hover:text-red-400 transition"
          >
            About
          </Link>
          <button 
            className="hover:text-red-400 transition cursor-pointer"
          >
            Privacy Policy
          </button>
          <button
            className="hover:text-red-400 transition cursor-pointer"
          >
            Terms of Service
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          © {new Date().getFullYear()} ComfTalk — AI Speech & Accent Practice. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
