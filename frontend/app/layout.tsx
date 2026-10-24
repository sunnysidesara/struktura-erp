import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "STRUKTURA",
  description: "Let's build your future.",
};

// Declaring a light colour scheme opts the page out of Chrome's "Auto Dark
// Theme", which otherwise rewrites <style> tags in the DOM (adding e.g.
// `native-dark-class-modified`) and triggers React hydration warnings.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // Browser extensions (dark-mode shims, translators) mutate attributes on
      // <html> before hydration; this keeps that from being reported as a bug.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
