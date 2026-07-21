import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZoraOS Observatory",
  description: "A bounded, evidence-aware research control room for ZoraOS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
