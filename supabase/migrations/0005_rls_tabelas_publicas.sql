-- Migration 0005: habilitar RLS nas tabelas públicas
--
-- A 0001 deixou RLS desabilitado de propósito, para simplificar a fase inicial,
-- e anotou que precisaria ser configurado antes do go-live. O site já está
-- público — e sem RLS a `publishable key`, que vai no bundle do browser e é
-- visível para qualquer visitante, tem permissão de ESCRITA no banco.
--
-- Verificado em 31/08/2026 contra produção: um insert com a chave pública
-- devolveu `409 duplicate key`, e não `403`. A requisição atravessou o RLS e só
-- parou na constraint de unicidade — ou seja, escrita liberada.
--
-- O risco concreto não é vandalismo de preço: é `update` em `offer.url`,
-- que trocaria a tag de afiliado das 451 ofertas e desviaria a receita sem
-- deixar rastro na interface.
--
-- Seguro de aplicar: todo write da aplicação passa por `supabaseAdmin`
-- (service_role, que bypassa RLS) — ingestão, OAuth e a rota /go. A chave
-- pública só faz select.

-- ─── Catálogo: leitura pública, escrita negada ───────────────────────────────
-- Sem policy de insert/update/delete, essas operações ficam negadas por padrão
-- para anon e authenticated. service_role continua passando por cima.

do $$
declare t text;
begin
  foreach t in array array[
    'category', 'brand', 'store', 'product', 'variant', 'offer', 'price_history'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_read_public', t);
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true)',
      t || '_read_public', t
    );
  end loop;
end $$;

-- ─── Tokens do Mercado Livre: nem leitura ────────────────────────────────────
-- RLS sem policy nenhuma nega tudo para anon e authenticated. Só a service_role
-- enxerga. Estes registros dão acesso à conta de afiliado do ComparaSuple.

alter table ml_oauth_tokens enable row level security;

-- click_event já teve RLS habilitado na 0004, com a mesma regra: nega tudo,
-- escrita só via service_role pela rota /go.

-- ─── Conferência ─────────────────────────────────────────────────────────────
-- Todas as linhas devem sair com rowsecurity = true.
select tablename, rowsecurity
from   pg_tables
where  schemaname = 'public'
order  by tablename;
