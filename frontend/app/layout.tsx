import Footer from "./components/Footer";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata = {
  title: "ComfTalk — AI Speech & Accent Practice",
  description: "Improve English fluency, rhythm, and accent with AI-powered coaching and real-time feedback",
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
        className="font-sans antialiased bg-gray-50 text-black dark:bg-gray-800 dark:text-white"
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
          {children}
        </ThemeProvider>
        <Footer/>
      </body>
    </html>
  );
}