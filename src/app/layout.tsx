import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";
import { AnnouncementTicker } from "@/components/home/AnnouncementTicker";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BJJ Wiki",
  description: "A community-driven Brazilian Jiu-Jitsu technique database",
};

import { getTechniqueTree, getRecentlyUpdatedTechniques } from "@/lib/technique-service";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [tree, recentlyUpdated] = await Promise.all([
    getTechniqueTree(),
    getRecentlyUpdatedTechniques(),
  ]);

  return (
    <html lang="ko" className="scroll-smooth">
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.className)}>
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            {/* 사이드바+메인을 포함해 화면 전체 폭을 가로지르도록 네비바와
                같은 레벨(형제)에 둔다. 홈페이지가 아니면 내부에서 null을
                반환한다 — Sidebar.tsx의 홈페이지 전용 top 오프셋과 짝을
                이루므로 함께 수정할 것. */}
            <AnnouncementTicker items={recentlyUpdated} />
            <div className="flex-1 flex">
              <Sidebar initialTree={tree} />
              <main className="relative w-full min-w-0 md:ml-64">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:py-10 md:pb-10">
                  {children}
                </div>
              </main>
            </div>
            <MobileBottomNav initialTree={tree} />
          </div>
        </Providers>
      </body>
    </html>
  );
}
