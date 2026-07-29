-- =============================================================
-- Portal do Fornecedor - Capital da Lingerie
-- Migration inicial: schema + RLS + RPC de criação de pedido
-- Rode no Supabase: SQL Editor -> cole este arquivo -> Run
-- =============================================================

-- ------------------------------------------------------------
-- Tabelas
-- ------------------------------------------------------------

-- Empresa fornecedora (uma por CNPJ)
create table if not exists fornecedores (
  id          uuid primary key default gen_random_uuid(),
  cnpj        text not null unique,
  nome        text not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Vínculo entre usuário do Supabase Auth e o fornecedor.
-- A Sewe/Capital cria o acesso e faz este vínculo (não há auto-cadastro).
create table if not exists fornecedor_usuarios (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  fornecedor_id  uuid not null references fornecedores(id) on delete cascade,
  created_at     timestamptz not null default now()
);

-- Produtos. O CUSTO vem pronto de fora (importação) e é TRAVADO:
-- nenhum fornecedor tem policy de escrita aqui — só o service_role (importação) grava.
create table if not exists produtos (
  id                 uuid primary key default gen_random_uuid(),
  fornecedor_id      uuid not null references fornecedores(id) on delete cascade,
  codigo_fornecedor  text not null,
  nome               text not null,
  custo              numeric(12,2) not null check (custo >= 0),
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (fornecedor_id, codigo_fornecedor)
);

-- Pedido registrado pelo fornecedor.
create table if not exists pedidos (
  id              uuid primary key default gen_random_uuid(),
  fornecedor_id   uuid not null references fornecedores(id),
  criado_por      uuid not null references auth.users(id) default auth.uid(),
  data_registro   timestamptz not null default now(),
  observacao      text,
  ciente_valores  boolean not null default false,
  ciente_em       timestamptz,
  total           numeric(14,2) not null default 0,
  created_at      timestamptz not null default now()
);

-- Itens do pedido. custo_unitario é um SNAPSHOT do custo no momento do pedido
-- (mantém o histórico estável mesmo que o custo do produto mude depois).
create table if not exists pedido_itens (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references pedidos(id) on delete cascade,
  produto_id     uuid not null references produtos(id),
  quantidade     integer not null check (quantidade > 0),
  custo_unitario numeric(12,2) not null,
  subtotal       numeric(14,2) not null
);

create index if not exists idx_produtos_fornecedor on produtos(fornecedor_id);
create index if not exists idx_pedidos_fornecedor  on pedidos(fornecedor_id);
create index if not exists idx_pedido_itens_pedido on pedido_itens(pedido_id);

-- ------------------------------------------------------------
-- Helper: fornecedor do usuário logado
-- security definer para conseguir ler o vínculo independentemente de RLS.
-- ------------------------------------------------------------
create or replace function current_fornecedor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select fornecedor_id from fornecedor_usuarios where user_id = auth.uid()
$$;

-- ------------------------------------------------------------
-- Row Level Security: cada fornecedor enxerga SÓ o que é dele
-- ------------------------------------------------------------
alter table fornecedores        enable row level security;
alter table fornecedor_usuarios enable row level security;
alter table produtos            enable row level security;
alter table pedidos             enable row level security;
alter table pedido_itens        enable row level security;

-- fornecedores: vê só o próprio registro
drop policy if exists forn_select_own on fornecedores;
create policy forn_select_own on fornecedores
  for select using (id = current_fornecedor_id());

-- vínculo: vê só o próprio
drop policy if exists fu_select_own on fornecedor_usuarios;
create policy fu_select_own on fornecedor_usuarios
  for select using (user_id = auth.uid());

-- produtos: SELECT só dos seus e ativos. SEM insert/update/delete para o fornecedor
-- => custo nunca é alterado à mão pelo usuário; só o service_role (importação) grava.
drop policy if exists prod_select_own on produtos;
create policy prod_select_own on produtos
  for select using (fornecedor_id = current_fornecedor_id() and ativo = true);

-- pedidos: vê e cria só os seus
drop policy if exists ped_select_own on pedidos;
create policy ped_select_own on pedidos
  for select using (fornecedor_id = current_fornecedor_id());

drop policy if exists ped_insert_own on pedidos;
create policy ped_insert_own on pedidos
  for insert with check (fornecedor_id = current_fornecedor_id());

-- itens: amarrados ao dono do pedido
drop policy if exists pi_select_own on pedido_itens;
create policy pi_select_own on pedido_itens
  for select using (
    exists (select 1 from pedidos p
            where p.id = pedido_id and p.fornecedor_id = current_fornecedor_id())
  );

drop policy if exists pi_insert_own on pedido_itens;
create policy pi_insert_own on pedido_itens
  for insert with check (
    exists (select 1 from pedidos p
            where p.id = pedido_id and p.fornecedor_id = current_fornecedor_id())
  );

-- ------------------------------------------------------------
-- RPC: criar_pedido
-- O cliente envia apenas produto_id + quantidade. O custo e o total são
-- SEMPRE calculados aqui, lendo do banco — nunca confiando em valor do cliente.
-- security invoker => roda sob RLS do fornecedor logado.
-- ------------------------------------------------------------
create or replace function criar_pedido(
  p_itens      jsonb,   -- [{"produto_id":"uuid","quantidade":3}, ...]
  p_observacao text,
  p_ciente     boolean
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_forn   uuid := current_fornecedor_id();
  v_pedido uuid;
  v_total  numeric(14,2) := 0;
  v_item   jsonb;
  v_prod   uuid;
  v_qtd    integer;
  v_custo  numeric(12,2);
begin
  if v_forn is null then
    raise exception 'Usuário sem fornecedor vinculado';
  end if;

  if p_ciente is not true then
    raise exception 'É necessário confirmar ciência dos valores do pedido';
  end if;

  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'Pedido sem itens';
  end if;

  insert into pedidos (fornecedor_id, observacao, ciente_valores, ciente_em, total)
  values (v_forn, p_observacao, true, now(), 0)
  returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_prod := (v_item->>'produto_id')::uuid;
    v_qtd  := (v_item->>'quantidade')::integer;

    if v_qtd is null or v_qtd <= 0 then
      raise exception 'Quantidade inválida para o produto %', v_prod;
    end if;

    -- custo SEMPRE do banco; RLS garante que o produto é do fornecedor logado
    select custo into v_custo
      from produtos
     where id = v_prod and fornecedor_id = v_forn and ativo = true;

    if v_custo is null then
      raise exception 'Produto inválido ou não pertence ao fornecedor: %', v_prod;
    end if;

    insert into pedido_itens (pedido_id, produto_id, quantidade, custo_unitario, subtotal)
    values (v_pedido, v_prod, v_qtd, v_custo, v_custo * v_qtd);

    v_total := v_total + v_custo * v_qtd;
  end loop;

  update pedidos set total = v_total where id = v_pedido;
  return v_pedido;
end;
$$;
