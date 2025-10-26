export default function Footer() {
  return (
    <footer className="w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 py-8">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-center md:text-left space-y-4 md:space-y-0">
        {/* Navigation Links */}
        <div className="flex space-x-6 text-gray-700 dark:text-gray-300 text-sm font-medium">
          <a
            href="/about"
            className="hover:text-red-600 dark:hover:text-red-400 transition"
          >
            About
          </a>
          <a
            href="/#"
            className="hover:text-red-600 dark:hover:text-red-400 transition"
          >
            Privacy Policy
          </a>
          <a
            href="/#"
            className="hover:text-red-600 dark:hover:text-red-400 transition"
          >
            Terms of Service
          </a>
        </div>

        {/* Copyright */}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          © {new Date().getFullYear()} AI Accent Training. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
