import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ShieldCheck, Sparkles } from "lucide-react";
import { SideNav, TopNav } from "@/components/nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dispute Copilot",
  description: "An AI agent that helps small sellers win PayPal disputes.",
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/30">
        <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.2} />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-zinc-900">Dispute Copilot</span>
        <span className="block text-[11px] font-medium text-zinc-500">AI for PayPal disputes</span>
      </span>
    </Link>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex min-h-screen">
          {/* Sidebar (desktop) */}
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-zinc-200/80 bg-zinc-50/80 p-4 lg:flex">
            <div className="space-y-8">
              <div className="px-1 pt-1">
                <Logo />
              </div>
              <SideNav />
            </div>
            <div className="space-y-2 rounded-2xl border border-zinc-200/80 bg-white p-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-zinc-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                PayPal sandbox connected
              </div>
              <div className="flex items-center gap-2 text-zinc-500">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                <span className="truncate">{model} · Groq</span>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar (mobile) */}
            <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-zinc-200/80 bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
              <Logo />
              <TopNav />
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
