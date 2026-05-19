import type { Metadata } from "next";
import "./globals.css";
import { Header } from "../components/header";

export const metadata: Metadata = {
  title: "Action Studio · Factory",
  description: "Operator console for Action Design Studio site runs.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink">
        <Header />
        <main className="mx-auto w-full max-w-[90rem] px-6 py-6">{children}</main>
        <footer className="mx-auto w-full max-w-[90rem] px-6 py-4 text-xs text-muted">
          Action Studio · Factory operator console
        </footer>
      </body>
    </html>
  );
}
