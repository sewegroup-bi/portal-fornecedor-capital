-- =============================================================
-- Histórico das saídas de dados (equivalente ao log de importações).
-- Registra cada vez que o arquivo de pedidos foi baixado ou gerado.
-- =============================================================

create table if not exists saidas (
  id            uuid primary key default gen_random_uuid(),
  executado_por uuid references auth.users(id) default auth.uid(),
  executado_em  timestamptz not null default now(),
  destino       text not null,          -- 'download' | 'arquivo'
  linhas        integer not null default 0,
  pedidos       integer not null default 0,
  arquivo       text,
  resultado     text not null default 'ok', -- 'ok' | 'erro'
  detalhe       jsonb
);

alter table saidas enable row level security;

drop policy if exists saidas_admin_select on saidas;
create policy saidas_admin_select on saidas
  for select using ((select is_admin()));

create index if not exists idx_saidas_executado_em on saidas(executado_em desc);
