import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner'; // 追加

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Radio Audio Generator",
  description: "AI Radio Script & Audio Generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        {children}
        <Toaster position="top-center" richColors /> {/* 追加: 通知の表示場所 */}
      </body>
    </html>
  );
}