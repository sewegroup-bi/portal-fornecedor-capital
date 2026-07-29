-- =============================================================
-- Seed de teste — prova o isolamento entre fornecedores (RLS)
-- Rode DEPOIS do 0001_init.sql, no SQL Editor do Supabase.
-- =============================================================

-- Dois fornecedores
insert into fornecedores (id, cnpj, nome) values
  ('11111111-1111-1111-1111-111111111111', '11.111.111/0001-11', 'Fornecedor Alfa Ltda'),
  ('22222222-2222-2222-2222-222222222222', '22.222.222/0001-22', 'Fornecedor Beta ME')
on conflict (cnpj) do nothing;

-- Produtos do Alfa (custo já vem pronto de fora — aqui simulado)
insert into produtos (fornecedor_id, codigo_fornecedor, nome, custo) values
  ('11111111-1111-1111-1111-111111111111', 'ALF-001', 'Sutiã Renda Preto',   29.90),
  ('11111111-1111-1111-1111-111111111111', 'ALF-002', 'Calcinha Algodão',    12.50)
on conflict (fornecedor_id, codigo_fornecedor) do nothing;

-- Produtos do Beta
insert into produtos (fornecedor_id, codigo_fornecedor, nome, custo) values
  ('22222222-2222-2222-2222-222222222222', 'BET-001', 'Camisola Cetim',      54.00),
  ('22222222-2222-2222-2222-222222222222', 'BET-002', 'Pijama Inverno',      78.30)
on conflict (fornecedor_id, codigo_fornecedor) do nothing;

-- --------------------------------------------------------------
-- Para testar o login: crie 1 usuário em Authentication -> Users
-- (ex.: alfa@teste.com), copie o UUID dele e rode:
--
--   insert into fornecedor_usuarios (user_id, fornecedor_id)
--   values ('<UUID-DO-USUARIO>', '11111111-1111-1111-1111-111111111111');
--
-- Ao logar com esse usuário, ele deve ver SÓ os produtos ALF-*.
-- --------------------------------------------------------------
