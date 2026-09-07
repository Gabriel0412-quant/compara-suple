# ML54-02 e ML54-03 — evidências para continuidade

Revisão de 06/09/2026. A ML54-01 foi entregue no commit `5a265a1`, na branch
`fix/ml54-01-affiliate-fallback`. Este documento registra descoberta; não aprova um formato de
afiliado nem declara as próximas tarefas implementadas.

## Evidência encontrada no projeto

O histórico de `data/items.json` no commit `159d5c8` contém 12 URLs no campo legado
`affiliate_url`, uma por catálogo. O commit `3d79997` contém cinco entradas com a mesma estrutura.
A estrutura sanitizada é:

```text
https://www.mercadolivre.com.br/social/<perfil>
  ?forceInApp=<valor>&matt_tool=<valor>&matt_word=<valor>&ref=<valor>
```

A ordem acima é apenas expositiva; não é um template para gerar ou reconstruir links.
Não foram copiados identificadores de perfil, valores de parâmetros ou URLs completas.

Nas 12 entradas examinadas não há chave por `item_id`, parâmetro `wid` nem fragmento de URL.
Também não há identificador MLB literal nos parâmetros, mesmo após decodificação percentual.
Isso não exclui identificadores opacos ou informações resolvidas pelo provedor; apenas impede
provar o vínculo do vendedor pela estrutura disponível. Os links não foram abertos ou expandidos.

Os títulos dos commits chamam esses links de oficiais, mas essa descrição não comprova emissão,
propriedade da conta, validade atual ou preservação do anúncio. Portanto, eles são referências
históricas e continuam sem autorização para publicação pelo novo resolvedor.

Não foi encontrado arquivo de configuração de produção no checkout examinado: existe somente
`.env.example`. A issue #54 não recebeu novos comentários de evidência até esta consulta.

## O que a documentação oficial esclarece

- A geração de links é oferecida pelo Gerador/Central e pela Barra de Afiliados.
  [Como gerar links](https://www.mercadolivre.com.br/l/afiliados-gere-seus-links).
- Etiquetas agrupam os links para consulta de métricas.
  [Como criar etiquetas](https://www.mercadolivre.com.br/l/organize-seus-links).
- A página do painel informa atualização das métricas a cada **3 horas**. Essa cadência não
  garante que uma verificação específica produza um clique válido.
  [Métricas do Afiliado](https://www.mercadolivre.com.br/l/acompanhe-suas-metricas).
- A janela de atribuição de vendas descrita pelo programa é de **24 horas**; ela é um conceito
  diferente da atualização do painel e não serve como prazo de processamento de clique.
  [Janela de atribuição](https://www.mercadolivre.com.br/l/afiliados-janela-de-atribuicao).
- As orientações pedem links de produtos/ofertas específicos e alertam contra bots que geram
  cliques artificiais. Por isso, validação HTTP e confirmação operacional precisam considerar
  seu efeito nas métricas; CI continua usando fixtures sintéticas.
  [Boas práticas](https://www.mercadolivre.com.br/l/boas-praticas-links).

As buscas nas páginas públicas do programa e no domínio de desenvolvedores não localizaram uma
API oficial documentada de geração disponível para esta conta. Isso não comprova que a API
inexista. Não se deve reaproveitar endpoints privados observados no portal nem criar parâmetros
por analogia. A importação por oferta permanece a alternativa prevista caso não haja API
oficial acessível.

## Continuidade com a base existente

Por orientação do usuário, a implementação das pendências usa o mapa `affiliate_urls`
por anúncio, a ingestão e a reconciliação existentes. A importação manual revisada é o
mecanismo escolhido para desenvolvimento; não depende de inventar uma API nem de abrir os
links históricos. Strings legadas continuam identificadas como não verificadas. O contrato
revisado define os dados necessários para distinguir uma entrada revisada, conferir anúncio
e vendedor e manter a URL importada integralmente.

O código, os testes e os procedimentos de atualização e rollback podem ser entregues com
fixtures sintéticas. A falta de acesso à conta não bloqueia essas entregas técnicas.
Conferir uma entrada curada não equivale a observar atribuição no painel: a cobertura real e
a métrica oficial continuam sendo resultados operacionais a registrar após a configuração.

## Verificação operacional após a entrega técnica

| Verificação | Situação |
| --- | --- |
| Cadência documentada do painel | 3 horas, sujeita a revalidação na operação |
| Estrutura histórica | Localizada; sem vínculo explícito com anúncio/vendedor |
| Mecanismo de implementação | Importação revisada por anúncio na curadoria existente |
| Cobertura das ofertas em produção | Ainda não medida nesta execução |
| Atribuição observada no painel | Ainda não verificada nesta execução |

Não é necessário fornecer outro arquivo para o desenvolvimento continuar. Os links sociais
históricos permanecem referências de formato e não são distribuídos entre ofertas de
vendedores distintos.
