-- =============================================================
-- Fix: total do pedido ficava 0.
-- Causa: pedidos tem RLS sem policy de UPDATE, então o
-- "update pedidos set total = ..." era bloqueado (0 linhas, sem erro).
-- Solução: calcular o total ANTES do insert e gravar o pedido já
-- com o valor correto — sem depender de UPDATE. Mantém o pedido
-- imutável pelo cliente (melhor para auditoria).
-- =============================================================

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

  -- 1ª passada: calcular o total lendo o custo do banco (nunca do cliente)
  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_prod := (v_item->>'produto_id')::uuid;
    v_qtd  := (v_item->>'quantidade')::integer;

    if v_qtd is null or v_qtd <= 0 then
      raise exception 'Quantidade inválida para o produto %', v_prod;
    end if;

    select custo into v_custo
      from produtos
     where id = v_prod and fornecedor_id = v_forn and ativo = true;

    if v_custo is null then
      raise exception 'Produto inválido ou não pertence ao fornecedor: %', v_prod;
    end if;

    v_total := v_total + v_custo * v_qtd;
  end loop;

  -- insere o pedido JÁ com o total correto (sem UPDATE posterior)
  insert into pedidos (fornecedor_id, observacao, ciente_valores, ciente_em, total)
  values (v_forn, p_observacao, true, now(), v_total)
  returning id into v_pedido;

  -- 2ª passada: inserir os itens (com snapshot do custo)
  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_prod := (v_item->>'produto_id')::uuid;
    v_qtd  := (v_item->>'quantidade')::integer;

    select custo into v_custo
      from produtos
     where id = v_prod and fornecedor_id = v_forn and ativo = true;

    insert into pedido_itens (pedido_id, produto_id, quantidade, custo_unitario, subtotal)
    values (v_pedido, v_prod, v_qtd, v_custo, v_custo * v_qtd);
  end loop;

  return v_pedido;
end;
$$;
