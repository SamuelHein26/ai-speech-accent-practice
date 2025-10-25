"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  if (!isOpen) return null;

  const handleLogin = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setError("");
    setLoading(true);

    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      if (res.status === 401) {
        throw new Error("Session expired. Please log in again.");
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Invalid credentials");
      }

      const data: { access_token: string } = await res.json();
      localStorage.setItem("token", data.access_token);
      window.dispatchEvent(new Event("authChange"));
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-transparent bg-opacity-40 backdrop-blur-sm z-50 animate-fadeIn">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 w-[95%] max-w-md transition-all transform hover:scale-[1.01]">
        {/* Title */}
        <h2 className="text-3xl font-bold text-center text-red-600 dark:text-red-500 mb-6">
          Welcome Back
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8 text-sm">
          Sign in to continue your AI Accent Training journey
        </p>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          {/* Email */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 mb-2 text-sm font-medium">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-gray-500 dark:text-gray-100 focus:ring-2 focus:ring-red-500 outline-none transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 mb-2 text-sm font-medium">
              Password
            </label>
            <div className="flex items-center gap-3">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-gray-500 dark:text-gray-100 focus:ring-2 focus:ring-red-500 outline-none transition"
              />
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(ev) => setShowPassword(ev.target.checked)}
                  className="accent-red-600"
                />
                Show
              </label>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 shadow-md transition-transform transform hover:scale-[1.02] cursor-pointer"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Footer Actions */}
        <div className="mt-6 flex justify-between items-center text-sm">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
            onClick={() => {
              onClose();
              router.push("/register");
            }}
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}