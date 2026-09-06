# ML54-02 — entrega técnica

A implementação reutiliza a curadoria por anúncio, o snapshot e o RPC existentes.
Objetos revisados são validados localmente e publicados sem reconstrução da URL;
strings legadas e candidatos rejeitados mantêm fallback por oferta. URL e
metadados de resolução são persistidos atomicamente em offer.url e offer.raw.

Coder, refactorer e gatekeeper concluíram três ciclos de revisão. O último
gate aprovou todos os dez cenários, 416 testes, propriedades, SQL, lint, tipos,
build e mutação com 316 mortos e nenhum sobrevivente ou caso sem cobertura.

Branch: fix/ml54-01-affiliate-fallback. Esta entrega é um commit local; a ML54-03
segue na mesma branch. O E2E será executado sobre o conjunto integrado.
Não houve cadastro de URLs reais, coleta, deploy, backfill ou comprovação de
atribuição no painel. Os links históricos por catálogo não foram distribuídos
entre anúncios.
