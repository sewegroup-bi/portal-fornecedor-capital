-- =============================================================
-- SAÍDA: bucket de armazenamento para "parquear" o arquivo de saída.
-- Substitui a gravação na pasta do Drive (que tinha atrito de permissão).
-- Bucket privado: o acesso é por URL assinada gerada pelo servidor.
-- Quando o Welligton definir como o Full Screen recebe, trocamos só o
-- adaptador de entrega (SFTP/API), reaproveitando o mesmo CSV.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('saida', 'saida', false)
on conflict (id) do nothing;
