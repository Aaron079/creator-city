import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PageTransition } from "@/components/layout/PageTransition";
import { FeedbackProvider } from "@/lib/feedback/useFeedback";
import { FloatingAgent } from "@/components/agent/FloatingAgent";
import { AuthProvider } from "@/components/auth/AuthProvider";

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
          <AuthProvider>
            <PageTransition>{children}</PageTransition>
            <FloatingAgent />
          </AuthProvider>
        </FeedbackProvider>
      </body>
    </html>
  );
}
