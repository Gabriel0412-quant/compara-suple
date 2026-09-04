import type { Metadata } from "next";
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

// Sem NEXT_PUBLIC_SITE_URL o Next resolve as URLs de Open Graph contra
// localhost, e todo link compartilhado sai quebrado. O fallback é o mesmo já
// usado em app/produtos/page.tsx.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://compara-suple-sable.vercel.app";

export const metadata: Metadata = {
  // Título simples, sem `template`. Cada página já escreve o próprio título
  // completo terminando em "· Preço Suplemento"; um template aqui duplicaria o
  // sufixo ("Ofertas em suplementos · Preço Suplemento | Preço Suplemento").
  title: "Preço Suplemento — compare e economize",
  description:
    "Compare ofertas de whey protein, creatina, pré-treino e mais no Mercado Livre. Preço por dose, preço por quilo e os vendedores lado a lado.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    siteName: "Preço Suplemento",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
