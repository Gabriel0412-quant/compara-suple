# Preço Suplemento — CLAUDE.md

Atualizado em 10/09/2026. Números medidos contra produção nesta data.

## O que é

Comparador de preços de suplementos no Brasil. A tese é **custo por dose**, não
preço de etiqueta: a embalagem mais barata costuma ser a menor.

**Só existe Mercado Livre.** Isso é a coisa mais importante deste arquivo,
porque a versão anterior dele dizia "lojas como Amazon, Mercado Livre, Netshoes
e Growth Supplements" — e essa frase é exatamente o tipo de afirmação que o
produto recusa. Enquanto houver um marketplace só, o que se compara são
anúncios dele, e o campo diz `ofertas`, nunca `lojas`. Amazon e Centauro estão
no plano (EP06), não no ar.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estrito · Tailwind 4 ·
Supabase (Postgres) · Vercel · pnpm 9.15.5 · vitest + Playwright + Stryker.

Rotas em `app/`, **não** em `src/app/`.

## Vocabulário

- **product** — o suplemento. 22 em produção.
- **variant** — sabor, gramas, doses. Colunas: `flavor`, `size_grams`, `servings`.
- **offer** — o anúncio com preço. Colunas: `price`, `available`, `raw`, `ml_rank`.
  Não existe coluna `is_active`: o campo é `available`.
- **brand** — fabricante. 7 em produção.
- **category** — derivada do **nome do produto** por palavra-chave em
  `lib/categories.ts`, não de `category_id`.

Não existe coluna de proteína por dose. Qualquer filtro ou rótulo que a cite
depende do EP15 enriquecer o catálogo.

## Rotas

```
/                    home
/produtos            busca com filtros          noindex quando filtrada
/categoria/[slug]    a mesma tela, categoria fixa no caminho, indexável
/produto/[slug]      página de produto
/comparar            comparador lado a lado
/ofertas             todas as ofertas
/marcas              índice de marcas
/go/[offerId]        saída rastreada para a loja
```

`/produtos` e `/categoria/[slug]` renderizam o mesmo corpo
(`components/busca/TelaDeBusca.tsx`). A rota de categoria existe separada
porque é a versão **indexável** da tela, com texto próprio — redirecionar para
`/produtos?categoria=` tiraria do índice as únicas listagens com conteúdo.

## A linha editorial

O site **não afirma o que não pode provar**. Não é retórica: está travado por
teste, e o build falha.

- **Menor preço ≠ destaque.** O ML promove oferta que nem sempre é a mais
  barata. As duas aparecem separadas e nomeadas.
- **Nada de veredito.** Não existe "melhor whey"; existe "menor R$/dose".
- **Dado ausente é informação.** "sem dose ou peso informado", não campo omitido.
  E seção sem dado **some** — não vira esqueleto nem "em breve".
- **Não medimos pessoas.** Sem cookie, sem identificador de sessão, sem
  analytics de terceiro (#17).
- **Cor de marca de terceiro não pinta cartão nosso** (#151). Logo é uso
  nominativo e vale; cartão vestido com a cor dela, não.
- **Nenhum número sem origem no banco.** `lib/stats.ts` existe porque a home já
  exibiu "1.482 produtos monitorados".

Quem faz cumprir: `lib/claims.ts` + `claims.test.ts` + `e2e/confianca.spec.ts`
(frases proibidas no código e no HTML servido), `lib/tokens.test.ts` (cor fora
dos tokens, e lista de espera do EP22), `e2e/home.spec.ts` (afirmações
bloqueadas e seções ausentes).

**Uma exceção consciente:** a faixa de alerta de preço e os guias estão na home
sem o serviço por trás (#213), por decisão do dono do produto, revertendo #129
e #130. Ela entrou com três limites travados por teste — sem `<form>` (senão o
Enter manda o e-mail para a URL e para os logs), nada anuncia sucesso, e os
guias são texto e não link. Enquanto o EP18 não entregar, quem digitar ali acha
que se cadastrou.

## Estado medido (10/09/2026)

```
produtos 22 | ofertas 1337 | ativas 986 | marcas 7
price_history 8.697 | max(fetched_at) 2026-09-08T12:07Z   ← 2 dias parado
ofertas ativas com link de afiliado: 1 de 986             ← #54
ui_event: HTTP 404                ← migration 0010 não aplicada
/api/health/ingestion: 503        ← #188
812 unitários (66 arquivos) + 195 de ponta a ponta + mutação em 100%
```

## Como se trabalha aqui

Um PR por issue, corpo explicando o **porquê** e os números medidos. Testes
junto. Português em commits, PRs, comentários e conversa.

**Antes de abrir o PR:** `pnpm lint`, `tsc --noEmit`, `pnpm test`,
`pnpm build`, `pnpm test:e2e`, `pnpm test:mutation`.

**Medir antes de mexer.** Repetidamente o diagnóstico mudou o trabalho: a
altura do card vinha do `article` não preencher o `li`; o filtro de sabor
precisava de normalização que ninguém tinha visto; o teste que falhava estava
certo e o código é que estava quebrado.

**Teste que falha pode estar certo.** Duas vezes nesta rodada o teste acusou
bug de verdade — um `<form>` que mandaria e-mail para a URL, e o roteador do
Next não re-renderizando com chave de query repetida. Isolar antes de ajustar o
teste.

**Mutação com Stryker.** Fixture que concorda com a regra não testa a regra: já
houve 45 sobreviventes num módulo cujos testes "passavam". Quando um mutante é
mesmo equivalente, declarar com `// Stryker disable` e escrever o motivo.

## Armadilhas já pagas

- **`gh` precisa de `--repo Gabriel0412-quant/compara-suple`** em comando de
  escrita: o clone tem dois remotes (`origin` e `fork`). `gh pr merge` e
  `gh pr close` são bloqueados para mim — passar ao usuário.
- **"Fecha #N" não fecha issue** — só `closes`/`fixes`/`resolves`.
- **Não empilhar PR.** Squash-merge + `--delete-branch` fecham o PR de cima.
- **Nunca colar `#` em comando para o usuário rodar**: zsh não trata como
  comentário e manda tudo como argumento.
- **Chave de query repetida quebra a navegação do Next.** `?marca=a&marca=b`
  troca a URL e não re-renderiza. Lista vai separada por vírgula.
- **Classe Tailwind montada em runtime não é gerada** e falha em silêncio.
- **`toContain` sobre número é quase sempre errado:** `"967 ofertas"` contém
  `"7 ofertas"`.
- **`innerText` aplica `text-transform` do CSS e inclui `sr-only`.**
- **`Intl` usa espaço não separável (U+00A0)** — comparar com `formatBRL`.
- **Fixar `TZ=UTC` nos testes.** Vercel roda em UTC, a máquina em BRT.
- **NÃO tocar `lib/ml/token-crypto.ts:8`** — `'compara-suple:ml-oauth:v1'` é
  additional data do AES-GCM; trocar invalida todo refresh token do banco.
- **`pnpm add` exige `-w`.**
- PostgREST: **401/42501 numa RPC prova que a função existe**; 404 PGRST202 é
  assinatura errada. **RLS sem policy devolve 200 com array vazio**, não 401.
