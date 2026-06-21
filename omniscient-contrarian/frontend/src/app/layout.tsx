import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Omniscient Contrarian",
  description: "BNB Hack 2026 AI Agent Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#EAEAEA] text-black`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
