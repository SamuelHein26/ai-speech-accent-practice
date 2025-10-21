"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import LoginModal from "../components/loginModal";
import ThemeToggle from "./ThemeToggle";
import { useRouter, usePathname } from "next/navigation";

export default function Header() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const profileRef = useRef<HTMLDivElement | null>(null);

  // --- Check for token on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  // --- Click outside closes profile dropdown
  useEffect(() => {
    const checkToken = () => setIsLoggedIn(!!localStorage.getItem("token"));
    checkToken();

    window.addEventListener("authChange", checkToken);
    return () => window.removeEventListener("authChange", checkToken);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("authChange"));
    setIsProfileOpen(false);
    router.push("/");
  };

  const getActiveClass = (path: string): string =>
    pathname === path
      ? "text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400"
      : "text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400";

  return (
    <header className="w-full flex justify-between items-center px-8 py-4 shadow bg-white dark:bg-gray-900 transition-colors relative">
      {/* Branding */}
      <h1 className="font-bold text-xl text-red-600 dark:text-red-500">
        <Link href="/">AI Accent Training</Link>
      </h1>

      {/* Center Nav */}
      <nav className="hidden md:flex items-center space-x-6">
        {/* Monologue */}
        <button
          onClick={() => router.push("/monologue")}
          className={`p-2 rounded-full hover:bg-red-50 dark:hover:bg-gray-800 transition cursor-pointer ${
            pathname === "/monologue" ? "bg-red-100 dark:bg-gray-800" : ""
          }`}
          title="Monologue Mode"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            className={`h-6 w-6 ${
              pathname === "/monologue"
                ? "text-red-600 dark:text-red-400"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 1.75a3.25 3.25 0 00-3.25 3.25v6a3.25 3.25 0 006.5 0v-6A3.25 3.25 0 0012 1.75zM5 10.25a7 7 0 0014 0M12 17.25v4.5"
            />
          </svg>
        </button>

        {/* Accent */}
        <button
          onClick={() => router.push("/accent")}
          className={`p-2 rounded-full hover:bg-red-50 dark:hover:bg-gray-800 transition cursor-pointer ${
            pathname === "/accent" ? "bg-red-100 dark:bg-gray-800" : ""
          }`}
          title="Accent Training"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 87.459 87.459"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.8"
            className={`h-7 w-7 ${
              pathname === "/accent"
                ? "text-red-600 dark:text-red-400"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            <path d="M37.44,73.283H7.694V55.66C2.787,51.136,0,44.811,0,38.09c0-13.186,10.728-23.913,23.913-23.913 c10.765,0,20.254,7.251,23.074,17.634l0.088,0.32l0.178,3.921l7.217,10.12l-6.344,4.608v3.524c0,4.244-3.453,7.698-7.7,7.698 h-2.985L37.44,73.283z" />
            <path d="M61.152,56.972L56.91,52.73c2.706-2.707,2.706-7.111-0.001-9.819l4.244-4.242C66.198,43.715,66.198,51.927,61.152,56.972z" />
            <path d="M69.251,63.361l-4.242-4.242c6.229-6.229,6.229-16.366,0-22.596l4.242-4.242C77.818,40.85,77.818,54.793,69.251,63.361z" />
            <path d="M78.555,69.351l-4.244-4.242c9.531-9.533,9.531-25.043,0.002-34.575l4.242-4.242 C90.427,38.161,90.427,57.478,78.555,69.351z" />
          </svg>
        </button>

        {/* About & Help */}
        <Link href="/about" className={`${getActiveClass("/about")} font-medium transition pb-1`}>
          About
        </Link>
        <Link href="/help" className={`${getActiveClass("/help")} font-medium transition pb-1`}>
          Help
        </Link>
      </nav>

      {/* Right Section */}
      <div className="flex items-center space-x-4 relative" ref={profileRef}>
        <ThemeToggle />

        {isLoggedIn ? (
          <div className="relative">
            {/* Profile Button */}
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="focus:outline-none bg-red-600 hover:bg-red-700 text-white font-medium rounded-full px-4 py-2.5 text-sm transition cursor-pointer"
            >
              Profile
            </button>

            {/* Dropdown */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 shadow-lg rounded-lg z-50">
                <button
                  onClick={() => router.push("/profile")}
                  className="block w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-gray-700 transition"
                >
                  View Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-700 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsLoginOpen(true)}
            className="focus:outline-none text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-5 py-2.5 cursor-pointer transition"
          >
            Login
          </button>
        )}

        {/* Hamburger */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-red-50 dark:hover:bg-gray-800 transition"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle Menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-6 w-6 text-red-600 dark:text-red-400"
          >
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Dropdown */}
      {isMenuOpen && (
        <div className="absolute top-16 left-0 w-full bg-white dark:bg-gray-900 shadow-md flex flex-col items-center space-y-4 py-6 md:hidden z-50">
          {["/monologue", "/accent", "/about", "/help"].map((path) => (
            <Link
              key={path}
              href={path}
              onClick={() => setIsMenuOpen(false)}
              className={`text-lg font-medium ${
                pathname === path
                  ? "text-red-600 dark:text-red-400 underline underline-offset-4"
                  : "text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400"
              } transition`}
            >
              {path === "/monologue"
                ? "Monologue"
                : path === "/accent"
                ? "Accent Training"
                : path === "/about"
                ? "About"
                : "Help"}
            </Link>
          ))}
        </div>
      )}

      {/* Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </header>
  );
}
