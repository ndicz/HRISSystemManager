import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Industri.HR",
  description: "HR & Payroll Outsourcing — PT Wana Samudra Persada",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
