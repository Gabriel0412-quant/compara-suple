# Entrega local — ML54-03

## Resultado

A ML54-03 foi aprovada pelo gate no ciclo 5 e validada pela suíte E2E integral. A aplicação e o rollback de links afiliados persistidos são realizados por RPC restrita; a saída pública continua passando por `/go` em home, listagem, produto e comparador.

## Evidências finais

- Gate: lint, TypeScript, build, banco PostgreSQL, integração HTTP, `527` testes Vitest e `2` propriedades aprovados.
- Mutação contra `8bba7ee28c22214b691a7ffe692993e3aa795b66`: `652` mortos, `0` sobreviventes e `0` sem cobertura. O único timeout é o mutante que remove o corpo do laço de paginação e cria laço infinito determinístico.
- Playwright: `99` cenários aprovados em Chromium, incluindo `TestPublicBuyFlows_ShouldUseGoRouteAcrossAllFourSurfaces`.
- Os testes usam fixtures sintéticas e bloqueiam navegação externa para Mercado Livre.

## Pendência operacional

CA13 e CA14 continuam pendentes até execução autorizada em ambiente real: inventário sanitizado, amostra de três produtos/três vendedores e observação posterior no painel. Esta entrega não executou links reais, não alegou atribuição observada, conversão ou comissão e não realizou deploy.
