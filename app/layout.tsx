import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans, Sofia_Sans } from "next/font/google";
import "./globals.css";

// Same fonts as the Eazotel website: Plus Jakarta Sans for text, Sofia Sans for headings.
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const sofiaSans = Sofia_Sans({
  variable: "--font-sofia-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Eazotel Admin", template: "%s | Eazotel Admin" },
  description: "Internal admin console for the Eazotel team.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${sofiaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
