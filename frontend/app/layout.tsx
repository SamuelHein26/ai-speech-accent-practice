import Footer from "./components/Footer";
import Header from "./components/Header";
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
        className="flex min-h-screen flex-col font-sans antialiased bg-ui-page text-ui-text"
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
