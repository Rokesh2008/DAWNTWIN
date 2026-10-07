import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DAWNTWIN",
  description: "Personalized Cardiovascular Digital Twin",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0f1c] text-[#e2e8f0]">
        <nav className="border-b border-[#1e293b] bg-[#0a0f1c]/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold tracking-tight">
                <span className="text-[#ef4444]">DAWN</span>
                <span className="text-[#3b82f6]">TWIN</span>
              </span>
            </Link>
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="text-sm font-mono text-[#94a3b8] hover:text-white transition"
              >
                Dashboard
              </Link>
              <Link
                href="/patients"
                className="text-sm font-mono text-[#94a3b8] hover:text-white transition"
              >
                Patients
              </Link>
              <Link
                href="/model"
                className="text-sm font-mono text-[#94a3b8] hover:text-white transition"
              >
                Model
              </Link>
              <span className="text-sm font-mono text-[#64748b]">
                Doctor Dashboard
              </span>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[#1e293b] py-3 px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-[10px] text-[#475569] font-mono">
            <span>DAWNTWIN v0.1 &mdash; Research Prototype</span>
            <span>
              Not a medical device. Not clinically validated. For research and
              demonstration purposes only.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
