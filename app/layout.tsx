import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deployer Agent — Deploy in a few clicks",
  description: "Connect Vercel, upload your project, and deploy instantly.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
