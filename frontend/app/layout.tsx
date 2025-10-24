import { Geist, Geist_Mono } from "next/font/google";
import Footer from "./components/Footer";

import { ThemeProvider } from "next-themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "AI Speech Training",
  description: "Improve fluency & accent with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow no-scrollbar">
      <body 
        suppressHydrationWarning 
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-black dark:bg-gray-900 dark:text-white`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
          {children}
        </ThemeProvider>
        <Footer/>
      </body>
    </html>
  );
}