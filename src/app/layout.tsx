import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { RealtimeProvider } from "@/components/RealtimeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FakeBook",
    template: "%s | FakeBook",
  },
  description: "一個仿造 Facebook 的社群網站，支援註冊與 Email 驗證。",
};

// FakeBook 的內容幾乎都依賴登入狀態（cookie）與資料庫，
// 允許路由在請求時阻塞渲染，不強制產生靜態 shell。
export const instant = false;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f0f2f5] text-[#1c1e21]">
        <RealtimeProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
        </RealtimeProvider>
      </body>
    </html>
  );
}
