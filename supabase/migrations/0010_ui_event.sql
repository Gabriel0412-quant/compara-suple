-- Migration 0010: eventos de uso das telas públicas
--
-- Mede o funil de descoberta sem identificar ninguém. A decisão, registrada na
-- #17, foi a opção A: nenhum identificador de pessoa ou de sessão. Cada linha é
-- um evento solto. Isso responde "quantas buscas terminaram em zero resultados"
-- e "de qual superfície vêm as saídas"; não responde "qual a taxa de conversão
-- de quem buscou". Quando o EP12 publicar a política de privacidade, um
-- identificador efêmero de sessão pode ser reavaliado.
--
-- Sem IP, sem cookie, sem user-agent, sem referrer. `click_event` guarda
-- referrer e user-agent desde a 0004 porque sustenta conferência de comissão;
-- aqui nada disso é necessário, então nada disso é coletado.

create table if not exists ui_event (
  id           bigserial primary key,
  evento       text        not null,
  -- Em que tela aconteceu: 'home', 'lista', 'comparador', 'produto'.
  superficie   text,
  -- busca_enviada: quantos resultados a consulta devolveu.
  n_resultados integer,
  -- comparacao_montada: quantos produtos entraram na comparação.
  n_produtos   integer,
  -- saida_para_loja: por qual critério a oferta clicada estava em destaque.
  criterio     text,
  -- Termo buscado. Ver a constraint abaixo: só existe em busca sem resultado.
  termo        text,
  created_at   timestamptz not null default now()
);

-- Vocabulário fechado. Um evento novo exige migration, o que força a decisão a
-- passar pelo dicionário da #17 em vez de aparecer no meio de um PR de UI.
alter table ui_event
  drop constraint if exists ui_event_evento_check,
  add constraint ui_event_evento_check check (
    evento in (
      'busca_enviada',
      'comparacao_montada',
      'metodologia_aberta',
      'saida_para_loja'
    )
  );

-- A regra de privacidade do termo vira restrição do banco, não convenção de
-- código. O texto livre da busca só se justifica quando vira decisão de
-- catálogo — "procuraram por BCAA e não temos" —, e é exatamente o caso em que
-- ele não descreve mais nada sobre quem digitou. Fora disso, o banco recusa.
alter table ui_event
  drop constraint if exists ui_event_termo_check,
  add constraint ui_event_termo_check check (
    termo is null
    or (evento = 'busca_enviada' and n_resultados = 0 and length(termo) <= 100)
  );

create index if not exists ui_event_evento_idx
  on ui_event (evento, created_at desc);

-- Consultar termos sem resultado é a pergunta mais frequente que esta tabela
-- responde; o índice parcial evita varrer eventos de outros tipos.
create index if not exists ui_event_termo_idx
  on ui_event (created_at desc)
  where evento = 'busca_enviada' and n_resultados = 0;

-- ─── RLS: ninguém lê pelo cliente ────────────────────────────────────────────
-- Mesma regra de click_event: RLS habilitado, policy nenhuma. Nega leitura e
-- escrita para anon e authenticated. Só a service_role enxerga, e só o servidor
-- escreve.
alter table ui_event enable row level security;
grant select, insert, delete on table ui_event to service_role;

-- ─── Retenção: 180 dias ──────────────────────────────────────────────────────
-- Prazo acordado na #17. Diferente de click_event, que não expira porque
-- sustenta conferência de comissão e apagá-lo reescreveria o passado.
create or replace function public.limpar_ui_event(p_dias integer default 180)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_apagados integer;
begin
  if p_dias < 1 then
    raise exception 'retencao_invalida';
  end if;
  delete from ui_event where created_at < now() - make_interval(days => p_dias);
  get diagnostics v_apagados = row_count;
  return v_apagados;
end;
$$;

revoke all on function public.limpar_ui_event(integer) from public, anon, authenticated;
grant execute on function public.limpar_ui_event(integer) to service_role;
