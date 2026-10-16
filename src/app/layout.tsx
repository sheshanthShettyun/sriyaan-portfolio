import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import Frame from "@/components/Frame";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sriyaan — Developer Portfolio",
  description:
    "I'm Sriyaan, a developer working across machine learning, LLMs, and backend infrastructure.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
        <body className={`${manrope.variable} ${geistMono.variable} min-h-screen bg-[#141414] text-[#F2EDE4]`}>
        <Frame>{children}</Frame>
      </body>
    </html>
  );
}
