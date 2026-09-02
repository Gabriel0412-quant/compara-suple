-- Teste da tabela de eventos de uso (EP14-07).
--
-- Roda dentro de begin/rollback, não deixa resíduo.
-- Sucesso = "ui_event: todos os casos ok".
--
-- A propriedade central: o termo de busca só pode existir onde vira decisão de
-- catálogo. Fora disso o banco recusa, e a política de privacidade da #17 deixa
-- de depender de alguém lembrar dela ao escrever código.

begin;

do $$
declare
  v_id      bigint;
  v_erro    text;
  v_apagados integer;
begin
  -- ── eventos válidos ────────────────────────────────────────────────────────
  insert into ui_event (evento, superficie, n_resultados)
  values ('busca_enviada', 'home', 7) returning id into v_id;
  if v_id is null then raise exception 'busca com resultado deveria ser aceita'; end if;

  insert into ui_event (evento, superficie, n_produtos)
  values ('comparacao_montada', 'comparador', 3);

  insert into ui_event (evento, superficie)
  values ('metodologia_aberta', 'produto');

  insert into ui_event (evento, superficie, criterio)
  values ('saida_para_loja', 'lista', 'menor_preco');

  -- ── termo: aceito só em busca sem resultado ────────────────────────────────
  insert into ui_event (evento, superficie, n_resultados, termo)
  values ('busca_enviada', 'lista', 0, 'bcaa');

  -- termo com resultado > 0 deve ser recusado
  begin
    insert into ui_event (evento, superficie, n_resultados, termo)
    values ('busca_enviada', 'lista', 5, 'whey');
    raise exception 'termo com resultados deveria ter sido recusado';
  exception when check_violation then null;
  end;

  -- termo em evento que não é busca deve ser recusado
  begin
    insert into ui_event (evento, superficie, termo)
    values ('metodologia_aberta', 'produto', 'qualquer coisa');
    raise exception 'termo fora de busca deveria ter sido recusado';
  exception when check_violation then null;
  end;

  -- termo longo demais deve ser recusado
  begin
    insert into ui_event (evento, superficie, n_resultados, termo)
    values ('busca_enviada', 'lista', 0, repeat('a', 101));
    raise exception 'termo acima de 100 caracteres deveria ter sido recusado';
  exception when check_violation then null;
  end;

  -- ── vocabulário fechado de eventos ─────────────────────────────────────────
  begin
    insert into ui_event (evento, superficie) values ('evento_inventado', 'home');
    raise exception 'evento fora do dicionario deveria ter sido recusado';
  exception when check_violation then null;
  end;

  -- ── retenção ───────────────────────────────────────────────────────────────
  insert into ui_event (evento, superficie, created_at)
  values ('metodologia_aberta', 'lista', now() - interval '200 days');

  select limpar_ui_event(180) into v_apagados;
  if v_apagados < 1 then
    raise exception 'limpeza deveria ter apagado o evento de 200 dias';
  end if;

  if exists (select 1 from ui_event where created_at < now() - interval '180 days') then
    raise exception 'sobrou evento acima da retencao';
  end if;

  -- eventos recentes continuam
  if not exists (select 1 from ui_event where evento = 'busca_enviada') then
    raise exception 'limpeza apagou evento dentro da retencao';
  end if;

  -- retenção inválida é erro, não apagar tudo
  begin
    perform limpar_ui_event(0);
    raise exception 'retencao zero deveria ter sido recusada';
  exception when others then
    get stacked diagnostics v_erro = message_text;
    if v_erro <> 'retencao_invalida' then raise; end if;
  end;

  raise notice 'ui_event: todos os casos ok';
end $$;

rollback;
