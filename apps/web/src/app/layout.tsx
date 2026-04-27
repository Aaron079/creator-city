import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PageTransition } from "@/components/layout/PageTransition";
import { FeedbackProvider } from "@/lib/feedback/useFeedback";
import { FloatingAgent } from "@/components/agent/FloatingAgent";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Creator City",
  description: "AI Creator City",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-city-bg text-white`}>
        <FeedbackProvider>
          <PageTransition>{children}</PageTransition>
          <FloatingAgent />
        </FeedbackProvider>
      </body>
    </html>
  );
}
