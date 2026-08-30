-- Migration 0004: tracking de cliques de afiliado
--
-- Até aqui os botões "Comprar" apontavam direto pro Mercado Livre. O link
-- carregava a tag de afiliado, então a comissão vinha — mas nós não ficávamos
-- com registro nenhum do clique. Sem isso não dá pra saber qual produto, qual
-- categoria ou qual página converte, e o CLAUDE.md pede que todo link externo
-- passe por tracking.
--
-- A rota /go/[offerId] grava aqui antes de redirecionar.

create table if not exists click_event (
  id         bigserial primary key,
  offer_id   bigint references offer(id) on delete set null,
  referrer   text,
  user_agent text,
  created_at timestamptz default now()
);

-- `on delete set null` e não `cascade`: quando a ingestão remove uma oferta que
-- saiu do ar, o histórico de cliques daquele dia continua valendo para o
-- relatório de receita. Perder a linha reescreveria o passado.

create index if not exists click_event_offer_idx
  on click_event (offer_id, created_at desc);

create index if not exists click_event_created_idx
  on click_event (created_at desc);

-- RLS
-- ---
-- O restante do schema ainda roda sem RLS (ver nota na 0001), mas aqui a
-- exceção se justifica: click_event é a única tabela com dado de comportamento
-- de visitante, e a publishable key roda no browser. Habilitamos RLS e não
-- criamos policy nenhuma — o efeito é negar leitura e escrita para anon.
-- A rota /go escreve via service_role, que bypassa RLS.
alter table click_event enable row level security;
