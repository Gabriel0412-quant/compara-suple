-- Teste de integração da reconciliação atômica (EP02-03).
--
-- Roda inteiro dentro de uma transação que termina em rollback: não deixa
-- nenhum resíduo no banco. Cole no SQL Editor do Supabase DEPOIS de aplicar
-- 0006_reconciliar_ofertas.sql. Sucesso = "reconciliacao: todos os casos ok".
--
-- Cobre os critérios que só o Postgres pode responder: desaparecimento,
-- snapshot vazio, idempotência, reativação e rollback.

begin;

do $$
declare
  v_store   bigint;
  v_brand   bigint;
  v_produto bigint;
  v_variant bigint;
  v_cat     text := '_teste_MLB_RECONCILIACAO';
  r         jsonb;
  v_ativas  int;
  v_id_a    bigint;
  v_id_b    bigint;
  v_hist    int;
begin
  -- ---------- fixtures ----------
  insert into store (slug, name) values ('_teste-loja', 'Loja de teste') returning id into v_store;
  insert into brand (slug, name) values ('_teste-marca', 'Marca de teste') returning id into v_brand;
  insert into product (slug, name, brand_id)
       values ('_teste-produto', 'Produto de teste', v_brand) returning id into v_produto;
  insert into variant (product_id) values (v_produto) returning id into v_variant;

  -- ---------- caso 1: snapshot [A,B] cria as duas ----------
  r := reconciliar_catalogo(v_store, v_cat, v_variant, jsonb_build_array(
         jsonb_build_object('external_id','MLB_A','url','https://x/a','price',10.00,'ml_rank',0,'raw','{}'::jsonb),
         jsonb_build_object('external_id','MLB_B','url','https://x/b','price',20.00,'ml_rank',1,'raw','{}'::jsonb)
       ));
  assert (r->>'recebidas')::int = 2, 'caso 1: recebidas ' || r::text;
  assert (r->>'criadas')::int = 2, 'caso 1: criadas ' || r::text;
  assert (r->>'indisponibilizadas')::int = 0, 'caso 1: indisponibilizadas ' || r::text;

  select id into v_id_a from offer where store_id = v_store and external_id = 'MLB_A';
  select id into v_id_b from offer where store_id = v_store and external_id = 'MLB_B';

  -- ---------- caso 2: repetir o mesmo snapshot é inofensivo ----------
  r := reconciliar_catalogo(v_store, v_cat, v_variant, jsonb_build_array(
         jsonb_build_object('external_id','MLB_A','url','https://x/a','price',10.00,'ml_rank',0,'raw','{}'::jsonb),
         jsonb_build_object('external_id','MLB_B','url','https://x/b','price',20.00,'ml_rank',1,'raw','{}'::jsonb)
       ));
  assert (r->>'criadas')::int = 0, 'caso 2: não devia criar nada — ' || r::text;
  assert (r->>'atualizadas')::int = 2, 'caso 2: atualizadas ' || r::text;

  select count(*) into v_ativas from offer where store_id = v_store and source_catalog_id = v_cat;
  assert v_ativas = 2, 'caso 2: duplicou ofertas (' || v_ativas || ')';

  select count(*) into v_hist from price_history where offer_id in (v_id_a, v_id_b);
  assert v_hist = 2, 'caso 2: duplicou histórico do dia (' || v_hist || ')';

  -- ---------- caso 3: [B,C] desativa A, atualiza B, cria C ----------
  r := reconciliar_catalogo(v_store, v_cat, v_variant, jsonb_build_array(
         jsonb_build_object('external_id','MLB_B','url','https://x/b','price',22.50,'ml_rank',0,'raw','{}'::jsonb),
         jsonb_build_object('external_id','MLB_C','url','https://x/c','price',30.00,'ml_rank',1,'raw','{}'::jsonb)
       ));
  assert (r->>'criadas')::int = 1, 'caso 3: criadas ' || r::text;
  assert (r->>'atualizadas')::int = 1, 'caso 3: atualizadas ' || r::text;
  assert (r->>'indisponibilizadas')::int = 1, 'caso 3: indisponibilizadas ' || r::text;

  assert (select available from offer where id = v_id_a) = false, 'caso 3: A continuou disponível';
  assert (select price from offer where id = v_id_b) = 22.50, 'caso 3: preço de B não subiu';
  assert (select ml_rank from offer where id = v_id_b) = 0, 'caso 3: ml_rank de B não acompanhou o snapshot';
  assert (select available from price_history where offer_id = v_id_a) = false,
         'caso 3: histórico de A não registrou a indisponibilidade';

  -- ---------- caso 4: A volta e reusa o mesmo registro ----------
  r := reconciliar_catalogo(v_store, v_cat, v_variant, jsonb_build_array(
         jsonb_build_object('external_id','MLB_A','url','https://x/a','price',11.00,'ml_rank',0,'raw','{}'::jsonb)
       ));
  assert (r->>'reativadas')::int = 1, 'caso 4: reativadas ' || r::text;
  assert (r->>'indisponibilizadas')::int = 2, 'caso 4: B e C deviam cair — ' || r::text;
  assert (select id from offer where store_id = v_store and external_id = 'MLB_A') = v_id_a,
         'caso 4: A ganhou um id novo em vez de reusar o antigo';
  assert (select available from offer where id = v_id_a) = true, 'caso 4: A não voltou a disponível';

  -- ---------- caso 5: snapshot válido e vazio zera o catálogo ----------
  r := reconciliar_catalogo(v_store, v_cat, null, '[]'::jsonb);
  assert (r->>'recebidas')::int = 0, 'caso 5: recebidas ' || r::text;
  assert (r->>'indisponibilizadas')::int = 1, 'caso 5: indisponibilizadas ' || r::text;

  select count(*) into v_ativas
    from offer where store_id = v_store and source_catalog_id = v_cat and available;
  assert v_ativas = 0, 'caso 5: sobrou oferta ativa (' || v_ativas || ')';

  -- ---------- caso 6: falha no meio reverte tudo ----------
  -- A constraint só existe dentro desta transação e some no rollback final.
  r := reconciliar_catalogo(v_store, v_cat, v_variant, jsonb_build_array(
         jsonb_build_object('external_id','MLB_A','url','https://x/a','price',10.00,'ml_rank',0,'raw','{}'::jsonb)
       ));
  alter table price_history add constraint _teste_rollback check (price <> 13.13);

  begin
    r := reconciliar_catalogo(v_store, v_cat, v_variant, jsonb_build_array(
           jsonb_build_object('external_id','MLB_D','url','https://x/d','price',13.13,'ml_rank',0,'raw','{}'::jsonb)
         ));
    raise exception 'caso 6: a reconciliação devia ter falhado';
  exception when check_violation then
    null;
  end;

  assert not exists (select 1 from offer where store_id = v_store and external_id = 'MLB_D'),
         'caso 6: a oferta nova sobreviveu ao rollback';
  assert (select available from offer where id = v_id_a) = true,
         'caso 6: A foi desativada por uma transação que falhou';

  alter table price_history drop constraint _teste_rollback;

  raise notice 'reconciliacao: todos os casos ok';
end;
$$;

rollback;
