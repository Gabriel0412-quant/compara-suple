-- Migration 0003: posição da oferta na resposta do ML
--
-- /products/{cat_id}/items devolve as ofertas em uma ORDEM ESPECÍFICA
-- onde a primeira é o buy box winner (vencedor da página de catálogo do ML).
-- Antes desta coluna, sortávamos por preço — o que não bate com o que o ML
-- mostra. Agora preservamos a posição original e sortamos por ela.

alter table offer
  add column if not exists ml_rank int;

comment on column offer.ml_rank is
  'Posição (0-based) da oferta na resposta /products/{id}/items do ML. Quanto menor, mais destacada pelo ML.';

create index if not exists offer_variant_rank_idx
  on offer (variant_id, ml_rank);
