import type { Metadata } from "next";
import { Familjen_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Tipografia de Preço Suplemento, definida no Claude Design (logo 5d).
//
// Servidas pelo próprio domínio via next/font: a maquete carregava por <link>
// para fonts.googleapis.com, o que em produção custa uma conexão externa e um
// flash de fonte a cada navegação.
//
// `latin-ext` além de `latin` porque a marca depende de acentuação — "Preço"
// tem ç e o catálogo está cheio de "Integralmédica", "pré-treino", "proteína".
// Os fallbacks importam pelo mesmo motivo: precisam desenhar ç e til sem
// substituir por caixa vazia enquanto a fonte carrega.
const familjenGrotesk = Familjen_Grotesk({
  variable: "--font-familjen-grotesk",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

// Sem NEXT_PUBLIC_SITE_URL o Next resolve as URLs de Open Graph contra
// localhost, e todo link compartilhado sai quebrado. O fallback é o mesmo já
// usado em app/produtos/page.tsx.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://compara-suple-sable.vercel.app";

export const metadata: Metadata = {
  // Título simples, sem `template`. Cada página já escreve o próprio título
  // completo terminando em "· ComparaSuple"; um template aqui duplicaria o
  // sufixo ("Ofertas em suplementos · ComparaSuple | ComparaSuple").
  title: "ComparaSuple — compare preços de suplementos",
  description:
    "Compare ofertas de whey protein, creatina, pré-treino e mais no Mercado Livre. Preço por dose, preço por quilo e os vendedores lado a lado.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    siteName: "ComparaSuple",
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
      className={`${familjenGrotesk.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
