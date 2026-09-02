# Testes de ponta a ponta

## Rodar

```
pnpm test:e2e          # headless, como no CI
pnpm test:e2e:ui       # modo interativo, para investigar uma falha
```

Na primeira vez, baixe o navegador: `pnpm exec playwright install chromium`.

Não é preciso subir nada à mão. O Playwright sobe o stub de dados e o app em
modo produção, e derruba os dois ao final.

## De onde vêm os dados

De `e2e/fixture.ts`, servido por `e2e/stub-supabase.ts` — nunca do Supabase real.

A razão é que as páginas são server components: consultam o banco no servidor, e
`page.route()` não alcança essas chamadas, porque elas não passam pelo navegador.
O ponto de controle possível é a URL que `lib/db.ts` lê de
`NEXT_PUBLIC_SUPABASE_URL`; o `playwright.config.ts` a aponta para o stub. O app
roda exatamente como em produção, e nenhum código de produção sabe que está em
teste.

Testar contra o Supabase real deixaria as asserções reféns do catálogo do dia:
uma coleta que tirasse uma oferta do ar quebraria o teste sem nada estar errado
no código.

## O que cada camada cobre

| Camada | Onde | O que garante |
|---|---|---|
| Lógica pura | `vitest` | regras de busca, comparação, destaque |
| Schema e SQL | job `database` do CI, Postgres real | migrations, reconciliação, simulação |
| Navegação e renderização | aqui | que clicar leva a algum lugar, e que a tela não quebra |

O stub não é um PostgREST completo e não precisa ser — o banco de verdade já é
exercitado pelo job `database`.

## Mexer no fixture quebra teste de propósito

As asserções afirmam contagens exatas (`toHaveCount(2)`), e é isso que as torna
capazes de pegar regressão. Ao adicionar produto ao fixture, espere ajustar
contagens — e confira se o número novo é o que você realmente esperava, em vez
de acertar o teste para o que apareceu.

## Se um teste passar quando não deveria

Um teste que nunca falha é decoração. Ao adicionar um, vale quebrar de propósito
o código que ele protege e confirmar que ele acusa. Foi assim que se descobriu
que a guarda `validos.length < 2` em `destacarMelhor` não tem efeito observável
na tela — o caso de um item só já é absorvido pela regra de empate, e quem
protege aquela distinção é o teste unitário, não o E2E.
