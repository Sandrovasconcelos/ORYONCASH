# OryonCash — Documento de Continuação (handoff)

Este documento existe para você continuar o desenvolvimento em outra ferramenta
(ex.: ChatGPT Codex) caso a sessão atual do Claude Code termine. Ele descreve
o projeto, o que já foi feito, o que está em andamento **neste exato
momento**, e os próximos passos concretos.

## O que é o projeto

**OryonCash** é um app pessoal (não multi-tenant) para controlar despesas de
obras de construção. Fluxo principal:

- O usuário (dono da obra) conversa com um **bot no WhatsApp** (Meta Cloud
  API oficial) para registrar despesas, cadastrar obras/materiais/
  fornecedores, importar orçamentos, e editar/excluir lançamentos — tudo por
  listas e botões interativos (não é IA de texto livre).
- Um **dashboard web** (Next.js + Supabase) mostra os dados: orçamento x
  executado por obra/categoria/etapa/material, histórico de atividades, CRUD
  das entidades.
- Esse módulo do WhatsApp é pensado como uma peça que, no futuro, vai
  alimentar um **app central maior** ("Oryon ERP", em Firebase) que o usuário
  está construindo separadamente — integração **explicitamente adiada**, não
  implementar agora.

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS v4, React 19,
Supabase (Postgres + Auth via `@supabase/ssr`, service-role admin client para
o bot), Meta WhatsApp Cloud API (Graph API v21.0), Google Gemini
(`gemini-flash-latest`) para OCR de nota fiscal/comprovante/áudio, Recharts
para gráficos, SheetJS `xlsx` (build do CDN, não o pacote npm) para ler
planilhas de orçamento.

## Estado atual — o que já está pronto e funcionando

Tudo isso foi implementado, testado (type-check limpo, verificado no
navegador) e está no código:

1. Schema completo no Supabase: `obras`, `categorias`, `etapas` (globais +
   por obra, com `valor_orcado`), `materiais`, `fornecedores` (com `cnpj`),
   `despesas`, `whatsapp_sessions`.
2. Bot do WhatsApp completo: menu principal, registrar despesa (fluxo
   guiado valor→obra→categoria→(material)→etapa→confirmação), cadastro de
   obra/material/fornecedor, "Ver Resumo", **Corrigir Lançamento** (editar
   campo a campo ou excluir uma despesa existente), **Remover Cadastro**
   (excluir obra/material/fornecedor).
3. Reconhecimento de nota fiscal/comprovante (foto/PDF) e áudio via Gemini,
   com classificação individual por item (cada item de uma nota com vários
   produtos vira uma despesa separada, com categoria/etapa próprias).
4. Dashboard web completo: login (Supabase Auth), CRUD de obras/materiais/
   fornecedores/despesas, importação de orçamento via planilha .xlsx
   (dashboard e WhatsApp), gráficos (Recharts) de gasto por categoria/
   material/tempo e orçado x executado por etapa.
5. **Log de auditoria completo**: tabela `atividades` registra toda
   criação/edição/exclusão (WhatsApp e dashboard), com autor, timestamp,
   resumo e dados antes/depois. Página `/dashboard/atividades` mostra o
   histórico com filtros por tipo/entidade.
6. **Atribuição de autor por número de WhatsApp**: tabela
   `usuarios_whatsapp` (telefone → nome) é a fonte tanto do nome exibido
   quanto da **autorização de acesso ao bot** — substituiu o antigo env var
   `ALLOWED_WHATSAPP_NUMBERS`. Página `/dashboard/numeros` deixa o usuário
   autorizar números **sem precisar de redeploy**.
7. Lista de despesas mostra "Lançado por" e "Registrado em" (data+hora).
8. Dashboard principal em abas (Resumo / Detalhes / Atividades) em vez de
   uma página única muito longa.
9. **Drill-down por categoria/etapa/material**: clicar em qualquer item da
   lista de detalhamento (ex.: "Instalações Elétricas") leva para
   `/dashboard/despesas` já filtrado por aquela categoria/etapa/material
   (mais o filtro de obra), com um chip mostrando o filtro ativo + subtotal
   e um "✕" para limpar. A página de despesas também ganhou um select de
   categoria no próprio formulário de filtro.

## ⚠️ Ação pendente do usuário (bloqueia parte do que já foi codificado)

Existe uma migration **já escrita mas ainda não aplicada** no Supabase:

```
supabase/migrations/20260726000000_atividades_e_autoria.sql
```

Ela cria as tabelas `usuarios_whatsapp` e `atividades`, e adiciona as colunas
`criado_por_telefone`/`criado_por_nome` em `despesas`. **Enquanto essa
migration não rodar no SQL Editor do Supabase, a página `/dashboard/despesas`
retorna lista vazia** (o `select()` inclui `criado_por_nome`, que não existe
ainda, e o Postgrest erra silenciosamente — isso já foi diagnosticado, não é
bug de código). Depois de rodar a migration, o usuário **precisa
imediatamente cadastrar o próprio número em `/dashboard/numeros`**, porque o
bot passou a checar essa tabela em vez do env var — sem isso, o bot para de
responder a todo mundo, inclusive o dono.

## 🔧 Trabalho em andamento agora (não terminado)

O usuário mandou um novo protótipo HTML de referência visual:

```
C:\Users\L_san\Downloads\oryoncash-prototipo-completo-v4-kanban (1).html
```

Pedido: fazer o dashboard do módulo WhatsApp usar **o mesmo design system**
desse arquivo (é um protótipo estático de um app maior, tipo kanban/ERP —
**não** replicar as telas de kanban/cronograma/contratos, só o sistema visual:
cores, tipografia, componentes). Também pediu: função de editar fornecedor
(não existe ainda, só criar) e visualizar lançamentos individuais agrupados
por categoria (isso último **já foi resolvido** com o drill-down descrito
acima, confirmado com o usuário via captura de tela).

O arquivo é grande (2.3MB, poucas linhas enormes com imagens base64 embutidas)
— **não dá pra abrir com um Read tool normal**. Extraia tokens/CSS com grep,
ex.:

```bash
grep -oE -- '--[a-zA-Z0-9-]+\s*:\s*[^;]+;' "caminho/do/arquivo.html" | sort -u
```

### Tokens de design já extraídos do protótipo (confirmados, prontos pra usar)

```css
--r: #e11b22;      /* vermelho da marca (igual ao que já usávamos) */
--rd: #ad0d13;      /* vermelho escuro/hover */
--rs: #fff0f1;      /* vermelho bem claro (fundo de badge/erro) */
--ink: #17191d;     /* texto principal / quase-preto */
--g: #272a30;       /* graphite / texto secundário forte */
--mut: #717781;     /* texto muted */
--line: #e6e8ec;     /* bordas */
--bg: #f4f5f7;       /* fundo da página */
--card: #fff;        /* fundo de card */
--shadow: 0 12px 34px rgba(20,22,26,.08);

--green: #158752;  --gs (fundo soft): #e9f8f0;   /* sucesso */
--amber: #bd7600;  --as (fundo soft): #fff4d9;   /* aviso */
--blue: #296dd1;   --bs (fundo soft): #eaf2ff;   /* info */

font: 14px/1.45 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

**Importante**: o protótipo **não tem dark mode** (nenhum
`@media (prefers-color-scheme: dark)` no arquivo — confirmado via grep). É um
app claro fixo, com **sidebar sempre escura** (`#111317`, independente do
tema). Decisão já tomada nesta sessão: **removemos o dark mode do dashboard
inteiro** para bater com essa referência (sidebar fixa escura, conteúdo
sempre claro), em vez de manter os dois temas.

Componentes de referência extraídos (specs exatas do protótipo):

- **Sidebar**: bg `#111317`, largura 270px, nav-btn texto `#aab0b9`, hover
  `color:#fff; background: rgba(255,255,255,.055)`, **ativo**:
  `background: linear-gradient(90deg, rgba(225,27,34,.24), rgba(225,27,34,.07)); box-shadow: inset 3px 0 0 var(--r); color:#fff` —
  ou seja, gradiente vermelho sutil + barra vermelha à esquerda (inset), não
  um bloco vermelho sólido como está hoje no nosso código.
- **Topbar**: `height:72px; position:sticky; top:0; background:rgba(255,255,255,.89); backdrop-filter:blur(15px); border-bottom:1px solid rgba(222,224,228,.9)`.
- **Card/KPI**: `background:#fff; border:1px solid var(--line); border-radius:18px`
  (sem shadow direto no card base — shadow é mais usado em modais).
  KPI: ícone chip 41x41 `border-radius:12px; background:#f2f3f5`, label
  uppercase 10px muted bold, valor `font-size:23px; font-weight:900; letter-spacing:-.04em`.
- **Botão** (`.btn`): `height:40px; border:1px solid var(--line); background:#fff; border-radius:11px; font-weight:800`.
  Primário (`.btn.primary`): `background:var(--r); border-color:var(--r); color:#fff`.
  Perigo (`.btn.danger`): `color:var(--r); border-color:#f0c7c9; background:#fff7f7`.
- **Input/select**: `height:39-40px; border:1px solid var(--line); border-radius:9-11px`;
  select tem `background:#f8f9fa`.
- **Badge/pill**: `border-radius:99px; padding:5px 8px; font-size:9px; font-weight:900`
  (ex.: `background:var(--gs); color:var(--green)`).
- **Tabela**: `th{padding:10px 13px; background:#f8f9fa; border-bottom:1px solid var(--line); font-size:8px; text-transform:uppercase; letter-spacing:.08em; color:#7b818a}`.
- **Modal**: centralizado, `border-radius:19px`, `box-shadow:0 25px 70px rgba(0,0,0,.2)`,
  header/footer com borda.
- **Avatar**: `border-radius:11px` (não círculo), gradiente
  `linear-gradient(145deg,#ef343a,#9c0b11)` pro avatar vermelho da marca.

### O que já foi feito nesta frente (dentro desta sessão)

- Removidas **todas** as classes `dark:` de todo `app/dashboard/**` e
  `app/login/page.tsx` (17 arquivos), via:
  ```bash
  perl -pi -e 's/\s*dark:[A-Za-z0-9\/:_.\[\]%-]+//g' <arquivo>
  ```
  Confirmado com `grep -rn 'dark:' app/dashboard app/login` → 0 ocorrências,
  e `npx tsc --noEmit` limpo depois da mudança.

### O que falta fazer nesta frente (próximos passos exatos)

1. **Atualizar `app/globals.css`**: trocar os valores das variáveis
   `--brand-*` para os tokens do protótipo listados acima (manter os MESMOS
   nomes de variável usados hoje — `--brand-red`, `--brand-red-700`,
   `--brand-black`, `--brand-gray-700`, `--brand-gray-500`,
   `--brand-gray-300`, `--brand-gray-100`, `--status-success`,
   `--status-warning`, `--status-info`, `--status-danger`, `--radius-card`,
   `--radius-brand-sm`, `--shadow-card` — só os valores mudam, não os
   nomes, pra não ter que reescrever classes em todo lugar). Sugestão de
   mapeamento:
   - `--brand-black` → `#17191d` (era `#111111`)
   - `--brand-gray-700` → `#272a30` (era `#4a4a4a`)
   - `--brand-gray-500` → `#717781` (era `#7a7a7a`)
   - `--brand-gray-300` → `#e6e8ec` (era `#d9d9d9`)
   - `--brand-gray-100` → `#f4f5f7` (era `#f2f2f2`)
   - `--brand-red-700` → `#ad0d13` (era `#a80e13`)
   - `--status-success` → `#158752`, `--status-warning` → `#bd7600`,
     `--status-info` → `#296dd1`, `--status-danger` → `#e11b22`
   - `--radius-card` → `18px` (era `16px`)
   - `--radius-brand-sm` → `11px` (era `10px`)
   - `--shadow-card` → `0 12px 34px rgba(20,22,26,.08)`
   - **Remover** o bloco `@media (prefers-color-scheme: dark)` inteiro (não
     precisa mais, já que tiramos os `dark:` de todo o app).
   - Atualizar a paleta de gráficos (`--chart-1` a `--chart-4`) pros mesmos
     valores de `--status-*` acima, já que eram derivados deles.
2. **Trocar fonte em `app/layout.tsx`**: hoje usa Orbitron (`--font-display`)
   + Montserrat (`--font-body`) — trocar por **Inter** só, via
   `next/font/google`, usada tanto pra `--font-display` quanto
   `--font-body` (o protótipo usa uma fonte só, Inter, em tudo).
3. **Atualizar `app/dashboard/sidebar.tsx`**: trocar o estado ativo de bloco
   vermelho sólido pro gradiente + inset border descrito acima
   (`bg-[linear-gradient(90deg,rgba(225,27,34,.24),rgba(225,27,34,.07))] shadow-[inset_3px_0_0_var(--brand-red)]`
   via arbitrary values do Tailwind, ou uma classe utilitária custom).
4. **Função de editar fornecedor** (pedido do usuário, ainda não feito):
   seguir exatamente o padrão já existente em
   `app/dashboard/despesas/[id]/page.tsx` + `updateDespesaAction` em
   `app/dashboard/actions.ts`. Precisa:
   - `app/dashboard/fornecedores/[id]/page.tsx` — formulário de edição
     (nome, contato, cnpj).
   - `updateFornecedorAction(formData)` em `actions.ts` — atualizar o
     registro + `registrarAtividade({ tipo: "edicao", entidade: "fornecedor", ... })`
     seguindo o mesmo padrão usado em `updateDespesaAction` (buscar o
     registro antes pra `dadosAntes`).
   - Adicionar link "Editar" na tabela de `app/dashboard/fornecedores/page.tsx`
     (mesmo padrão do link "Editar" em `despesas/page.tsx`).
   - Considerar também excluir fornecedor pelo dashboard (hoje só existe
     via WhatsApp / "Remover Cadastro") — não foi pedido explicitamente,
     perguntar antes de fazer.
5. Depois de tudo isso, rodar `npx tsc --noEmit` e verificar visualmente no
   navegador (`npm run dev`, já configurado em `.claude/launch.json` como
   `oryoncash-dev` na porta 3000) em pelo menos: `/dashboard`,
   `/dashboard/despesas`, `/dashboard/obras`, `/login`.

## Armadilhas e lições já aprendidas (não repetir)

- **Nunca confiar que uma migration rodou** só porque não deu erro na hora
  de escrever o SQL — sempre verificar direto no Supabase via client
  admin (script Node inline lendo `.env.local`) antes de dizer que uma
  feature está funcionando. Já aconteceu 2x de a migration não ter sido
  aplicada e a feature "quebrada" ser só isso.
- **Gemini**: usar sempre `gemini-flash-latest` (não `gemini-2.5-flash`,
  que dá 404 pra chaves novas).
- **`xlsx`**: instalado via tarball do CDN da SheetJS
  (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), não
  `npm install xlsx` puro (versão do npm tem vulnerabilidade de prototype
  pollution sem correção).
- **Telefone brasileiro no WhatsApp**: o `wa_id` que o Meta manda no
  webhook às vezes vem **sem o "9" adicional** do celular
  (`5598988219864` real vira `559888219864` no payload). A função
  `variantesTelefone()` em `lib/whatsapp/verify.ts` já trata isso gerando
  as duas variantes antes de checar `usuarios_whatsapp` — manter esse
  tratamento em qualquer mudança nessa área.
- **Arquivos HTML grandes de referência de design** (esse protótipo e os
  dois anteriores de identidade visual): não dá pra ler com a ferramenta
  Read normal (excede limite / linhas gigantes com base64). Sempre extrair
  com `grep -oE` / `awk` / `sed`, nunca tentar ler o arquivo inteiro.
- Este projeto já passou por um **redesign visual completo anterior**
  (ver histórico do plano em `C:\Users\L_san\.claude\plans\vivid-floating-elephant.md`,
  que documenta a primeira versão do design system — vermelho/preto/branco,
  Orbitron+Montserrat — agora sendo substituída pela v2 baseada neste novo
  protótipo).

## Pendência antiga, ainda não resolvida (não relacionada ao design)

O usuário nunca mandou a lista de números de telefone que queria autorizar
no bot — mas isso **não é mais um problema**, porque agora ele mesmo
consegue adicionar números em `/dashboard/numeros` (ver acima), depois que a
migration rodar.

## Mapa de arquivos-chave

- `lib/conversation/engine.ts` — máquina de estados do bot (grande, ~1500
  linhas). Todos os pontos de mutação já gravam em `atividades` via
  `registrarAtividade` (`lib/atividades.ts`).
- `lib/conversation/queries.ts` — funções de acesso a dados usadas pelo bot.
- `app/dashboard/actions.ts` — server actions do dashboard (todas com
  `registrarAtividade` já plugado).
- `lib/whatsapp/verify.ts` — assinatura do webhook + `isAllowedNumber`
  (agora assíncrona, consulta `usuarios_whatsapp`).
- `app/globals.css` — tokens de design (ver seção acima pra próxima
  atualização).
- `supabase/migrations/` — migrations em ordem cronológica pelo nome do
  arquivo; a mais recente (`20260726000000_atividades_e_autoria.sql`) ainda
  não foi aplicada pelo usuário.
