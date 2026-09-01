-- Teste do modo de simulação (EP02-07).
--
-- Roda dentro de begin/rollback, não deixa resíduo. Cole no SQL Editor depois
-- de aplicar 0007_reconciliar_simulacao.sql.
-- Sucesso = "simulacao: todos os casos ok".
--
-- A propriedade central: a simulação prevê exatamente o que a execução real
-- faz, e não deixa nenhum efeito.

begin;

do $$
declare
  v_store    bigint;
  v_brand    bigint;
  v_produto  bigint;
  v_variant  bigint;
  v_cat      text := '_teste_MLB_SIMULACAO';
  v_sim      jsonb;
  v_real     jsonb;
  v_snapshot jsonb;
  v_id_a     bigint;
  v_ofertas  int;
  v_hist     int;
begin
  insert into store (slug, name) values ('_teste-loja', 'Loja de teste') returning id into v_store;
  insert into brand (slug, name) values ('_teste-marca', 'Marca de teste') returning id into v_brand;
  insert into product (slug, name, brand_id)
       values ('_teste-produto', 'Produto de teste', v_brand) returning id into v_produto;
  insert into variant (product_id) values (v_produto) returning id into v_variant;

  -- Estado inicial: A e B ativas.
  perform reconciliar_catalogo(v_store, v_cat, v_variant, jsonb_build_array(
    jsonb_build_object('external_id','MLB_A','url','https://x/a','price',10.00,'ml_rank',0,'raw','{}'::jsonb),
    jsonb_build_object('external_id','MLB_B','url','https://x/b','price',20.00,'ml_rank',1,'raw','{}'::jsonb)
  ));
  select id into v_id_a from offer where store_id = v_store and external_id = 'MLB_A';
  select count(*) into v_ofertas from offer where store_id = v_store;
  select count(*) into v_hist from price_history ph
    join offer o on o.id = ph.offer_id where o.store_id = v_store;

  -- Snapshot seguinte: A some, B muda de preço, C aparece.
  v_snapshot := jsonb_build_array(
    jsonb_build_object('external_id','MLB_B','url','https://x/b','price',22.50,'ml_rank',0,'raw','{}'::jsonb),
    jsonb_build_object('external_id','MLB_C','url','https://x/c','price',30.00,'ml_rank',1,'raw','{}'::jsonb)
  );

  -- ---------- caso 1: simular não altera nada ----------
  v_sim := reconciliar_catalogo(v_store, v_cat, v_variant, v_snapshot, true);

  assert (v_sim->>'simulado')::boolean, 'caso 1: retorno não marcou simulado';
  assert (select count(*) from offer where store_id = v_store) = v_ofertas,
         'caso 1: a simulação criou ou apagou oferta';
  assert (select available from offer where id = v_id_a) = true,
         'caso 1: a simulação desativou A';
  assert (select price from offer where store_id = v_store and external_id = 'MLB_B') = 20.00,
         'caso 1: a simulação alterou o preço de B';
  assert not exists (select 1 from offer where store_id = v_store and external_id = 'MLB_C'),
         'caso 1: a simulação criou C';
  assert (select count(*) from price_history ph
            join offer o on o.id = ph.offer_id where o.store_id = v_store) = v_hist,
         'caso 1: a simulação gravou histórico';

  -- ---------- caso 2: simular duas vezes dá o mesmo resultado ----------
  assert reconciliar_catalogo(v_store, v_cat, v_variant, v_snapshot, true) = v_sim,
         'caso 2: duas simulações do mesmo snapshot divergiram';

  -- ---------- caso 3: a previsão bate com a execução real ----------
  v_real := reconciliar_catalogo(v_store, v_cat, v_variant, v_snapshot, false);

  assert not (v_real->>'simulado')::boolean, 'caso 3: execução real marcada como simulada';
  assert v_sim - 'simulado' = v_real - 'simulado',
         'caso 3: previsão ' || v_sim::text || ' != realidade ' || v_real::text;

  -- E a execução real fez mesmo o que foi previsto.
  assert (select available from offer where id = v_id_a) = false, 'caso 3: A não caiu';
  assert (select price from offer where store_id = v_store and external_id = 'MLB_B') = 22.50,
         'caso 3: B não atualizou';
  assert exists (select 1 from offer where store_id = v_store and external_id = 'MLB_C'),
         'caso 3: C não foi criada';

  -- ---------- caso 4: simular o snapshot vazio prevê o esvaziamento sem executá-lo ----------
  v_sim := reconciliar_catalogo(v_store, v_cat, null, '[]'::jsonb, true);

  assert (v_sim->>'indisponibilizadas')::int = 2, 'caso 4: previsão ' || v_sim::text;
  assert (select count(*) from offer where store_id = v_store and available) = 2,
         'caso 4: a simulação do vazio desativou de verdade';

  -- ---------- caso 5: erro de argumento falha igual nos dois modos ----------
  begin
    perform reconciliar_catalogo(v_store, v_cat, null, v_snapshot, true);
    raise exception 'caso 5: simulação aceitou variant nulo com ofertas';
  exception when raise_exception then
    if position('p_variant_id' in sqlerrm) = 0 then
      raise exception 'caso 5: erro inesperado — %', sqlerrm;
    end if;
  end;

  raise notice 'simulacao: todos os casos ok';
end;
$$;

rollback;
