# Arquitetura e decisões — Portal do Fornecedor

Documento para quem vai **dar manutenção ou evoluir** o projeto. Explica *por que* as
coisas são como são, quais armadilhas já custaram tempo e o que ainda está em aberto.

Para instalar e operar, ver [README.md](README.md).

---

## 1. Princípios (não quebrar sem discussão)

### 1.1 O ERP é a fonte da verdade do cadastro
O cadastro de fornecedores, produtos e custos nasce e é mantido no **ERP (Full Screen)**.
O portal **espelha** — não cria nem edita. Toda correção é feita no ERP e chega pela
importação.

Consequência prática: telas de "corrigir cadastro" **não devem existir**. Já houve uma
tela de correção de CNPJ que foi removida por isso (commits 785fa52 → 46dd78a). Quando
o portal encontra dado inconsistente, ele **reporta** (ver `/admin/documentos`).

### 1.2 Cadastro → ERP; acesso → portal
O ERP não tem o conceito de "acesso ao portal", então **gerenciar login é do portal**.
Daí existirem dois e-mails distintos, de propósito:

| Campo | Significado | Quem escreve |
|---|---|---|
| `fornecedores.email` / `fornecedores.emails` | e-mail de contato do fornecedor | só a importação (espelho do ERP) |
| `fornecedor_usuarios.email` | credencial de login no portal | o convite, na tela de acessos |

Eles podem divergir legitimamente: o ERP costuma ter o e-mail fiscal/financeiro,
enquanto quem **opera** o portal pode ser outra pessoa.

### 1.3 O custo nunca é editável pelo fornecedor
Não existe policy de escrita em `produtos`. Só a importação (via `service_role`) grava
custo. E o total do pedido é **sempre recalculado no banco** a partir do custo
armazenado — nunca se confia em valor enviado pelo cliente (ver `criar_pedido`).

### 1.4 Isolamento entre fornecedores é responsabilidade do banco
Row Level Security, não filtro na aplicação. Se a query esquecer um `where`, o RLS
ainda protege. Nunca use `service_role` para atender requisição de fornecedor.

### 1.5 A interface fala a língua do usuário, não a do desenvolvedor
Quem usa o painel é a equipe da Capital/Sewe, não um desenvolvedor. Nomes de arquivo,
pasta, tabela, view, bucket ou tecnologia **não aparecem na tela** — ficam neste
documento e no README.

| Na tela | Nos bastidores |
|---|---|
| "Catálogo e custos" | importação do `fornecedores.csv` do Drive |
| "Dados dos pedidos" | view `saida_pedidos` |
| "Baixar planilha" | `GET /api/admin/saida` |
| "Gerar arquivo para o BI" | upload no Storage, bucket `saida` |
| "atualizado / nada novo / falhou" | `importado` / `sem_alteracao` / `erro` |

Mensagens de erro são exceção: podem trazer o detalhe técnico, porque servem para
diagnóstico.

---

## 2. Fluxo de dados

```
ERP (Full Screen)
   └─ BI/Qlik exporta fornecedores.csv
        └─ pasta ENTRADA DE DADOS (Google Drive)
             └─ [cron 1x/hora] portal importa (upsert, idempotente)
                  └─ POSTGRES (Supabase) ── portal do fornecedor → PEDIDOS
                       └─ view saida_pedidos
                            ├─ download CSV (pronto)
                            ├─ arquivo no Supabase Storage (pronto)
                            └─ SFTP / API do ERP  ← A DEFINIR (Full Screen)
```

**Sobre a saída:** o Qlik lê e analisa, **não escreve dentro do ERP**. Quem importa o
pedido para o Full Screen é o próprio ERP (arquivo ou API). A geração está pronta e
desacoplada — quando o formato for definido, basta plugar o adaptador de entrega.

---

## 3. Modelo de dados

| Tabela | Papel |
|---|---|
| `fornecedores` | espelho do cadastro do ERP. **Chave natural: `codigo_fabricante`** |
| `produtos` | catálogo com custo. Chave: `fornecedor_id + codigo_fornecedor` |
| `fornecedor_usuarios` | vínculo login ↔ fornecedor (N logins por fornecedor) |
| `admin_usuarios` | quem é administrador |
| `pedidos` / `pedido_itens` | pedidos e itens. `custo_unitario` é **snapshot** |
| `importacoes` | log de cada atualização do catálogo (entrada) |
| `saidas` | log de cada geração/download do arquivo de pedidos (saída) |

### Views (saída e telas de admin)
Todas com `security_invoker = true` para **respeitarem o RLS**:
`saida_pedidos`, `admin_resumo`, `admin_pedidos`, `admin_acessos`,
`fornecedores_documentos_pendentes`.

### Decisões de modelagem que têm motivo
- **Fornecedor é identificado por `codigo_fabricante`, não por CNPJ.** Há fabricantes
  pessoa física (CPF) e ~69% dos documentos vêm corrompidos da origem. Usar CNPJ como
  chave descartava 40% do catálogo. O documento virou atributo classificado
  (`documento_tipo`: `CNPJ` / `CPF` / `INVALIDO`).
- **`pedido_itens.custo_unitario` é snapshot.** O histórico do pedido não muda quando o
  custo do produto é atualizado depois.
- **`produtos.busca` é coluna gerada** (`codigo + ref + nome`) com um único índice GIN
  trigram — ver armadilha 4.2.

---

## 4. Armadilhas conhecidas (já custaram tempo)

### 4.1 RLS: função em policy roda uma vez POR LINHA
Policy escrita como `using (is_admin())` faz o Postgres executar a função **para cada
linha** — em 105 mil produtos a busca levava 6-8 s e estourava o *statement timeout*.

```sql
-- ❌ lento
using ( fornecedor_id = current_fornecedor_id() )
-- ✅ vira initPlan: roda uma vez por query
using ( fornecedor_id = (select current_fornecedor_id()) )
```

Vale para `auth.uid()`, `is_admin()`, `current_fornecedor_id()`. É o lint
`auth_rls_initplan` da Supabase. **Sempre envolver em `(select ...)`.**
Bônus: consolide policies (fornecedor + admin em uma só) — todas as policies
permissivas são avaliadas.

### 4.2 Busca: `OR` em várias colunas não usa índice bem
Três `ilike` com `OR` sobre colunas diferentes tem plano ruim. A solução foi uma
**coluna gerada concatenada** (`produtos.busca`) com **um** índice GIN trigram.

### 4.3 PostgREST: dentro de `.or()`, o curinga do `ilike` é `*`, não `%`
```ts
// ❌ filtro é silenciosamente ignorado
.or(`nome.ilike.%${t}%`)
// ✅
.or(`nome.ilike.*${t}*`)
```
Fora do `.or()`, `.ilike('col', '%t%')` funciona normalmente.

### 4.4 Função `security invoker` não faz UPDATE em tabela com RLS sem policy
O `update pedidos set total = ...` era **bloqueado em silêncio** (0 linhas, sem erro) e
o pedido ficava com total 0. Solução: calcular o total **antes** do insert e gravar o
pedido já correto — sem UPDATE, e o pedido segue imutável pelo cliente.

### 4.5 Conta de serviço do Google não escreve em "Meu Drive"
Leitura funciona; criar arquivo dá `File not found` (404) porque a conta de serviço não
tem cota de armazenamento própria. Exigiria Drive Compartilhado — e mover a pasta
falhou por ter arquivos de donos diferentes. **Por isso a saída foi para o Supabase
Storage**, e o escopo do Drive voltou a ser somente leitura.

### 4.6 `create or replace view` não muda colunas
Se a lista de colunas mudou, é `drop view` + `create view`.

### 4.7 `gin_trgm_ops` não deve ser qualificado com schema
`extensions.gin_trgm_ops` falha se a extensão estiver em `public`. Use sem qualificar —
o `search_path` resolve.

### 4.8 Limites de tempo/tamanho na Vercel
Server Action aceita ~1 MB e request ~4,5 MB — por isso o CSV de 13 MB **nunca** passa
pelo upload: o servidor busca direto no Drive.

Sobre **tempo**: o plano Hobby limita a função a 60 s, o que obrigava a importação a ser
paginada pelo navegador (14 chamadas de 8 mil linhas — e 14 linhas no histórico). Com o
plano **Pro** (`maxDuration = 300`) a importação virou **um único passe**: um botão e uma
linha de log. Se algum dia o plano voltar para Hobby, isso volta a estourar.

---

## 5. Importação

- **Idempotente**: `upsert` por chave natural. Rodar de novo **atualiza**, não duplica.
- **Pula quando nada mudou**: compara o `md5Checksum` do arquivo do Drive com o da
  última importação bem-sucedida. É o que torna o ciclo horário barato.
- **Não remove** produto que saiu do arquivo (decisão pendente — ver §7).
- **Tolerante a dado sujo**: documento inválido não bloqueia a linha; é classificado e
  reportado. Custo em formato brasileiro (`"3,5"`) é convertido.
- **E-mails**: o parser já aceita as colunas mais prováveis (`email`, `e_mail`,
  `email_fabricante`…), inclusive vários e-mails na mesma célula separados por `;` ou `,`.
  Hoje o ERP ainda não exporta esse campo.

Código: `src/lib/import/executarImportacao.ts` e `parseFornecedores.ts`.

Toda execução (automática ou manual) grava uma linha em `importacoes`, com o resultado
(`importado` / `sem_alteracao` / `erro`) e o checksum do arquivo lido. A rota manual usa
`forcar: true` para atualizar mesmo sem mudança no arquivo.

---

## 5b. Saída

Uma única função (`gerarSaidaCsv`) monta o arquivo a partir da view `saida_pedidos` e é
usada pelos dois destinos já prontos:

| Destino | Rota | O que faz |
|---|---|---|
| Download | `GET /api/admin/saida` | devolve o CSV para o navegador |
| Arquivo para o BI | `POST /api/admin/saida` | grava no Supabase Storage (bucket `saida`) e devolve link assinado de 1 ano |

Os dois registram uma linha em `saidas` (destino, nº de pedidos, nº de itens, resultado),
exibida no painel como *Histórico de envios de dados*. O terceiro destino — entrega direta
ao ERP por SFTP ou API — é só mais um adaptador consumindo a mesma função.

O CSV leva **BOM UTF-8**, senão o Excel no Windows exibe os acentos errados.

---

## 6. Segurança — resumo

- Fornecedor só enxerga o próprio dado (RLS por `fornecedor_id`).
- `produtos` não tem policy de escrita: custo é intocável pelo fornecedor.
- Total e ciência são gravados por `criar_pedido` no servidor, com timestamp.
- Corte de acesso é imediato: `current_fornecedor_id()` só resolve vínculo `ativo`.
- `service_role` **apenas** em rotas de servidor (importação, saída, convites), nunca
  no navegador.
- Um login pertence a um único fornecedor; convidar e-mail já vinculado a outro
  fornecedor retorna 409 em vez de mover o vínculo silenciosamente.
- `/api/cron/importar` exige `Authorization: Bearer $CRON_SECRET`.

---

## 7. Em aberto

**Dependem de terceiros**
1. **Formato de retorno dos pedidos ao ERP** (Full Screen / Welligton) — geração pronta,
   falta o adaptador de entrega (SFTP ou API).
2. **Coluna de e-mail no CSV do ERP** — habilita convite em lote (parser já preparado).
3. **Correção dos documentos inválidos no ERP** — relatório em `/admin/documentos`.

**Decisões de negócio pendentes**
4. **Produto descontinuado**: hoje continua ativo no portal quando sai do arquivo. Há a
   coluna `situacao` (`I`/`E`) importada, que pode virar a regra de exibição.
5. **Aviso de divergência de e-mail**: quando o ERP trouxer e-mail, sinalizar (sem
   bloquear) convite com e-mail diferente do cadastro.

**Melhorias técnicas**
6. Separar admin de fornecedor no ambiente de teste (hoje `alfa@teste.com` é os dois, o
   que atrapalha a visão de fornecedor).
7. Coluna de último login e lista de convites pendentes em `/admin/acessos`.

---

## 8. Convenções

- Migrations **numeradas e sequenciais**, nunca editadas depois de aplicadas em
  produção: para corrigir, crie a próxima. Escreva SQL idempotente
  (`if not exists`, `drop ... if exists`).
- Código e comentários em **português**, explicando o *porquê* — não o *o quê*.
- Antes de commitar: `npx tsc --noEmit && npx next build`.
- Toda leitura de dado de fornecedor passa pelo client autenticado (RLS).
  `service_role` só onde está documentado.
