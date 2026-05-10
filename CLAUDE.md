# ComparaSuple — CLAUDE.md

## O que é este projeto
Marketplace e comparador de suplementos para o Brasil. Os usuários buscam suplementos
(whey protein, creatina, vitaminas, pré-treino etc.) e comparam preços entre lojas como
Amazon, Mercado Livre, Netshoes, Growth Supplements e outras.

## Stack técnica
- Framework: Next.js 14 com App Router
- Linguagem: TypeScript (tipagem estrita)
- Estilo: Tailwind CSS
- Banco de dados: PostgreSQL via Supabase
- Hospedagem: Vercel
- Gerenciador de pacotes: pnpm

## Vocabulário do domínio
- **Product**: o suplemento em si (ex: "Growth Whey Protein")
- **Variant**: variação do produto (sabor, tamanho em gramas, número de doses)
- **Offer**: o produto sendo vendido em uma loja específica, com preço
- **Store**: loja online (Amazon, Mercado Livre, Netshoes etc.)
- **Brand**: fabricante (Growth Supplements, Max Titanium, Integralmédica etc.)
- **Category**: categoria do suplemento (Proteínas, Creatinas, Vitaminas etc.)

## Estrutura de pastas
src/app/                    → páginas (App Router)
  categoria/[slug]/         → página de categoria
  produto/[slug]/           → página de produto
  comparar/                 → comparador lado a lado
  busca/                    → busca de produtos
  go/[offerSlug]/           → redirecionamento de afiliado (tracking)
  api/                      → rotas de API
src/components/
  ui/                       → componentes genéricos
  product/                  → componentes de produto
  compare/                  → componentes do comparador
src/lib/
  db.ts                     → cliente do Supabase/banco de dados
  pricing.ts                → cálculos de preço (R/dose,R/dose, R
/dose,R/g proteína)
  score.ts                  → score de custo-benefício
  affiliate.ts              → geração de links de afiliado
src/jobs/                   → scripts de coleta de preços

## Schema do banco de dados (Supabase/PostgreSQL)
```sql
create table category (id bigserial primary key, slug text unique not null, name text not null, parent_id bigint references category(id));
create table brand (id bigserial primary key, slug text unique not null, name text not null);
create table store (id bigserial primary key, slug text unique not null, name text not null, affiliate_type text, base_url text);
create table product (id bigserial primary key, slug text unique not null, name text not null, brand_id bigint references brand(id), category_id bigint references category(id), description text, created_at timestamptz default now());
create table variant (id bigserial primary key, product_id bigint references product(id) on delete cascade, ean text, flavor text, size_grams numeric, servings numeric);
create table offer (id bigserial primary key, variant_id bigint references variant(id) on delete cascade, store_id bigint references store(id), url text not null, price numeric not null, available boolean default true, fetched_at timestamptz default now());
create table price_history (id bigserial primary key, offer_id bigint references offer(id) on delete cascade, price numeric not null, available boolean, observed_at date not null, unique (offer_id, observed_at));
```

## Regras importantes
- Mobile first: todas as páginas devem funcionar bem em celular antes do desktop
- SEO: usar SSR ou ISR (nunca CSR puro) nas páginas de produto e categoria
- Afiliados: todos os links externos passam pela rota /go/[slug] para tracking
- ANVISA: nunca usar linguagem de promessa terapêutica ("cura", "trata", "previne")
- LGPD: não armazenar dados pessoais sem consentimento explícito
- Scraping: respeitar robots.txt e os Termos de Serviço de cada loja
- Performance: manter Core Web Vitals no verde (LCP < 2.5s, CLS < 0.1)

## Monetização
- Afiliados: Amazon Associados (9.5%), Mercado Livre (5-8%), Netshoes (até 13%)
- Ads: Google AdSense / Ezoic (programático)
- Tracking de cliques: tabela click_event no banco

## Objetivo do MVP
Catálogo de 200-400 SKUs, comparador funcional, cálculo de R$/dose,
histórico de preços, SEO básico — tudo pronto para lançamento público.