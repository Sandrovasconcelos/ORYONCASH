# Checklist de Produção — OryonCash — Status Real

Análise item a item do checklist de 40 seções contra o código atual do
repositório. Legenda: ✅ implementado · ⚠️ parcial/frágil · ❌ não existe.

Contexto importante que molda várias respostas abaixo: **este é um app de
uso pessoal/single-tenant** (uma empresa, um dono, alguns números de
WhatsApp autorizados) — não um SaaS multiempresa. Isso explica por que
seções inteiras (RBAC, multiempresa, aprovações por alçada) simplesmente
não existem: não foram construídas porque nunca foram pedidas, não porque
foram esquecidas. Sinalizado item a item abaixo.

---

## 1. Arquitetura e estrutura do sistema

- ✅ Frontend/backend/banco separados (Next.js App Router + Server Actions + Supabase Postgres).
- ⚠️ Ambientes dev/staging/production — só existe `.env.local` (dev) e produção (Vercel). **Sem staging.**
- ❌ Nunca fica claro se dev usa banco separado do de produção — na prática, todo teste que fiz hoje rodou direto contra o banco de produção (não há outro).
- ✅ Variáveis de ambiente centralizadas em `.env.local` / Vercel env vars.
- ✅ Nenhum secret commitado (`.gitignore` cobre `.env*`).
- ⚠️ Modular por domínio só parcialmente — `app/dashboard/actions.ts` tem quase 3.000 linhas com todos os domínios juntos (despesas, obras, qualidade, cronograma, checklist, medições...).
- ⚠️ Regras financeiras majoritariamente em server actions (bom), mas sem camada de `services/repositories` separada — a query Supabase e a regra de negócio ficam na mesma função.
- ❌ Sem documentação de arquitetura (só `HANDOFF.md`/`ROADMAP.md` no nível de features, não de arquitetura).
- ✅ Tratamento de erro padronizado nos server actions (retry defensivo pra colunas que podem não existir ainda, try/catch nos uploads).

## 2. Usuários, empresas e permissões

- ✅ Usuário individual (Supabase Auth) pro dashboard.
- ❌ Conceito de "empresa" **não existe** — é single-tenant por design.
- ❌ RBAC / perfis (Administrador, Financeiro, Engenharia, Compras, Consulta) — **não existe**. Hoje é binário: logado no dashboard = acesso total; número autorizado no WhatsApp = acesso total ao bot.
- ❌ Limites de aprovação por usuário/perfil — não existe.
- ✅ Autorização no backend (server actions rodam server-side, não dá pra burlar pela UI) — mas sem granularidade de quem pode o quê.
- ⚠️ RLS existe em toda tabela, mas é `for all to authenticated using (true) with check (true)` — ou seja, **qualquer usuário autenticado acessa tudo**. Não há isolamento por empresa/obra porque não existe esse conceito no modelo hoje.
- ✅ Bloquear usuário do WhatsApp sem apagar histórico — existe (`toggleNumeroAtivoAction`, campo `ativo` em `usuarios_whatsapp`).
- ❌ Bloquear usuário do dashboard sem excluir — não existe fluxo (só existe o usuário Supabase Auth único).

## 3. Autenticação

- ✅ Login via Supabase Auth (e-mail/senha).
- ❌ Recuperação de senha pelo próprio app — hoje só pelo painel do Supabase (item já estava no ROADMAP).
- ⚠️ Confirmação de e-mail — depende de configuração do projeto Supabase, não verificado no código.
- ❌ MFA/2FA — não configurado.
- ⚠️ Expiração de sessão — usa o padrão do Supabase Auth (JWT + refresh token), não customizado.
- ❌ Revogação de sessão / logout de todos os dispositivos — não implementado.
- ❌ Rate limiting no login — nenhum rate limiting em lugar nenhum do app (confirmado via busca no código).
- ❌ Proteção contra força bruta além do que o Supabase Auth já faz nativamente.
- ❌ Log de tentativas suspeitas de login — não existe.

## 4. Segurança do banco de dados

- ✅ Nenhuma tabela sem RLS habilitado.
- ⚠️ Policies revisadas → sim, mas são todas permissivas (`using (true)`) — ver seção 2.
- ✅ Backend nunca confia em `user_id` do frontend (server actions usam sessão do Supabase server-side).
- ✅ Migrations usadas consistentemente (33 arquivos em `supabase/migrations/`, sequenciais e datados).
- ✅ Estrutura do banco versionada via migrations.
- ⚠️ Constraints/FKs existem na maioria das tabelas, mas nem todas (ex.: `despesas.material_id`/`fornecedor_id` são nullable sem FK enforcement documentado em todas as versões).
- ✅ Índices em campos de busca frequente (`created_at`, `entidade`, etapa_id, medicao_id, etc.).
- ⚠️ Registros órfãos possíveis — `etapas.obra_id` pode ficar `null` (etapas "genéricas" por design), então não é bug, mas não há verificação ativa de órfãos indevidos.
- ❌ Transações explícitas em operações financeiras compostas — **não existem**. Ex.: `registrarPagamentoMedicaoAction`/`liberarPagamentoEtapaAction` fazem múltiplos `insert`/`update` sequenciais sem transação — se cair no meio, fica em estado parcial (isso é um risco real, ver seção 6).

## 5. Lançamentos financeiros

Campos hoje na tabela `despesas`: `id, obra_id, categoria_id, etapa_id,
material_id, fornecedor_id, conta_bancaria_id, valor, quantidade,
valor_unitario, descricao, data, origem, criado_por_telefone,
criado_por_nome, created_at, deleted_at, deleted_by, deleted_reason`.

- ✅ ID único, obra, categoria, fornecedor, valor, data, observação (descrição), comprovante, usuário responsável, origem, criado em.
- ❌ Empresa — não existe (single-tenant).
- ❌ Centro de custo / subcategoria — não existem como conceitos separados (categoria é o nível único de classificação).
- ⚠️ Data de competência vs data de pagamento — só existe **uma** data (`data`), sem separar competência de pagamento.
- ❌ Forma de pagamento como campo estruturado na despesa — existe só dentro do comprovante (`metodo_pagamento` em `despesa_comprovantes`), não na despesa em si.
- ✅ Conta utilizada (`conta_bancaria_id`).
- ✅ Número do documento (`despesa_comprovantes.numero_documento`).
- ✅ Data/hora de criação (`created_at`).
- ❌ **Data/hora da última alteração — não existe.** `updateDespesaAction` atualiza a linha mas não há `updated_at` na tabela `despesas`. O histórico de alteração fica só no log de atividades (`dados_antes`/`dados_depois`), não como coluna própria.
- ✅ Origem padronizada: `whatsapp` | `dashboard` (o checklist sugere também `IMPORTAÇÃO`/`API`/`AUTOMAÇÃO`, que não existem porque essas vias de entrada não existem no sistema).

## 6. Integridade financeira

- ✅ `numeric(14,2)` pra valores monetários em todas as tabelas — nunca `float`.
- ✅ Arredondamento padronizado (`Math.round(valor * 100) / 100` em `parseValorBR`).
- ✅ Moeda única (BRL, implícito em todo o sistema).
- ✅ Valores inválidos bloqueados (`valor <= 0` rejeitado nos server actions).
- ⚠️ Obra obrigatória — sim na maioria dos fluxos, mas `createDespesaAction` do dashboard permite? (checa `!obraId` → return, então é obrigatório) — ✅ na prática.
- ⚠️ Classificação (categoria) obrigatória — sim no dashboard, mas o bot do WhatsApp tem fallback pra "Sem classificação" em vários pontos vistos hoje nos dados reais (ex.: várias despesas com etapa "Sem classificação").
- ✅ **Detecção de nota duplicada — implementada hoje** (por número de documento, avisa antes de duplicar).
- ⚠️ Alerta de comprovante duplicado — só cobre nota fiscal (número do documento), não comprovante de pagamento avulso.
- ❌ Alerta "mesmo fornecedor + valor + data" — não existe essa heurística adicional (só a de número de documento).
- ❌ Conciliação bancária — não existe (item grande do ROADMAP, "ainda não iniciado").
- ❌ **Status do lançamento (`PENDENTE/CLASSIFICADO/APROVADO/PAGO/CANCELADO`) — não existe.** Uma despesa lançada já nasce "definitiva"; o único ciclo de status parecido é o de `medicoes` (`preparada/aprovada/paga`), que é de outro módulo (medição de etapa), não da despesa em si.

## 7. Exclusões e alterações

- ✅ **Soft delete é o padrão em quase tudo** — `deleted_at`/`deleted_by`/`deleted_reason` em despesas, obras, etapas, materiais, fornecedores, medições, contratos, checklists, etc. (18 migrações adicionaram esses campos).
- ✅ Quem excluiu, quando, motivo — todos os três campos presentes e preenchidos.
- ⚠️ Manter valor anterior/novo — só existe dentro do JSON `dados_antes`/`dados_depois` do log de atividades, não como colunas dedicadas na própria despesa.
- ✅ Histórico completo de alterações — via tabela `atividades` (`tipo`, `dados_antes`, `dados_depois`, `resumo`), populado consistentemente em quase toda ação do dashboard e do bot.
- ✅ Restaurar registro — existe tela de Lixeira (`/dashboard/lixeira`) com restauração pra obra, etapa, contrato, modelos, conta bancária.

## 8. Audit Log

Tabela `atividades`: `id, tipo, entidade, entidade_id, origem,
autor_telefone, autor_nome, resumo, dados_antes, dados_depois,
created_at`.

- ✅ Usuário (autor_nome/autor_telefone).
- ✅ Data/hora (`created_at`).
- ❌ IP — não é registrado em lugar nenhum.
- ✅ Ação executada (`tipo`: criação/edição/exclusão) + resumo em texto legível.
- ✅ Registro alterado (`entidade` + `entidade_id`).
- ✅ Dados anteriores e posteriores (JSON completo).
- ✅ Origem da alteração (`whatsapp` | `dashboard`).
- ✅ O formato de exibição "Sandro alterou: Valor R$X → R$Y" que o checklist dá de exemplo **já existe** — é como a tela de Atividades mostra hoje.

## 9. WhatsApp

- ⚠️ Identificação por telefone — sim, mas **sem validação além de estar na lista de números autorizados** (`usuarios_whatsapp`). Qualquer app que consiga mandar mensagem daquele número passa.
- ❌ Empresa — não existe.
- ✅ Associar lançamento à obra — obrigatório no fluxo guiado.
- ✅ Confirmar valor/fornecedor/categoria/obra/data antes de finalizar — sim, o fluxo do bot sempre mostra resumo com botão "Confirmar" antes de gravar (`enviarConfirmacao`, `enviarConfirmacaoNota`).
- ✅ Cancelar operação — comando "cancelar"/"sair" reseta a sessão a qualquer momento.
- ✅ Corrigir informação anterior — fluxo "Corrigir lançamento" dedicado.
- ❌ Timeout de conversa — sessão (`whatsapp_sessions`) não expira sozinha; fica esperando resposta indefinidamente.
- ✅ **Idempotência do webhook** — dedup por `wamid` (`whatsapp_mensagens_processadas`), confirmado no código.
- ✅ ID da mensagem do WhatsApp registrado (mesma tabela de dedup).
- ⚠️ Status da operação — não há status persistido por mensagem processada (só o dedup binário processada/não processada).
- ❌ Fila de processamento — não existe; o webhook processa síncrono, sem fila.
- ❌ Reprocessamento automático de falhas — não existe.
- ❌ Dead Letter Queue — não existe.

## 10. Comprovantes e documentos

- ✅ Formatos autorizados validados (`validarArquivo` com `Set` de MIME types permitidos, ex.: imagem/PDF, ou PDF/Word pra contratos).
- ⚠️ Limite de tamanho — só o `bodySizeLimit: "10mb"` global do Next.js (`next.config.ts`), não um limite específico por tipo de arquivo.
- ✅ Nome interno único gerado (`${Date.now()}-${crypto.randomUUID()}.ext`) — nunca usa o nome original do arquivo como path.
- ✅ MIME type validado antes do upload.
- ✅ Bucket protegido — Supabase Storage privado, acesso só via signed URL.
- ✅ Nada fica público — confirmado, todo link de documento no dashboard/relatório/PDF usa `createSignedUrl`.
- ✅ Validade das URLs definida (1h pra uso imediato, 7 dias pra relatório/PDF/CSV, 24h pra relatório do WhatsApp).
- ❌ Log de quem acessou documento sensível — não existe (só sabe quem *anexou*, não quem *visualizou* depois).
- ⚠️ Preview de PDF/imagem — o navegador abre o link direto (`target="_blank"`), não tem preview embutido no app.
- ✅ Download autorizado — via signed URL, que já é a barreira de autorização.
- ✅ Substituir documento mantendo histórico — existe pra contrato de fornecedor e comprovante de despesa (reclassificar/substituir sem perder o rastro na tabela de atividades).

## 11. OCR e IA

- ⚠️ **IA lança direto sem "confiança" explícita** — o Gemini extrai os dados da nota e, se `itens.length === 1`, entra no fluxo guiado (que pede confirmação); mas o valor extraído já populam os campos e o usuário só confirma, não há um score de confiança mostrado nem um "isso está com baixa certeza, revise com atenção".
- ✅ Valor identificado é salvo.
- ❌ Confiança da extração — a API do Gemini não retorna e o sistema não pede/calcula isso.
- ❌ Texto bruto extraído — não é salvo separadamente (só os campos estruturados já interpretados).
- ⚠️ Diferenciar "extraído" de "confirmado" — existe implicitamente (o usuário sempre confirma antes de gravar), mas não há um campo tipo `extraido_por_ia: true` salvo na despesa final.
- ✅ Usuário pode editar antes de confirmar (todo o fluxo é editável campo a campo).
- ✅ Detecção de duplicidade — implementada hoje (nota fiscal).
- ❌ Registrar modelo/versão da IA usada — não é salvo por lançamento (o modelo vem de env var `GEMINI_MODEL`, mas não fica gravado em qual despesa usou qual versão).
- ✅ Fallback quando IA falha — sim, `iniciarFallbackManual` pede os dados por texto quando a extração falha ou não identifica nada.

## 12. Obras

Tabela `obras`: `id, nome, orcamento_total, data_inicio, status,
categoria_medicao_padrao_id, created_at, deleted_at...`.

- ✅ Nome, orçamento previsto, status, data inicial.
- ❌ Código da obra — não existe campo próprio (só o nome, que às vezes já inclui um prefixo tipo "01 Costa Amalfitana" como convenção manual, não campo estruturado).
- ❌ Empresa / Cliente / Localização — não existem.
- ❌ Data prevista de conclusão — não existe (só `data_inicio`).
- ✅ Valor realizado — calculado dinamicamente (soma de despesas), não armazenado, mas exibido.
- ❌ Responsável pela obra — não existe campo.
- ✅ Etapas — existem e são ricamente modeladas.
- ❌ Centros de custo — não existe esse conceito (ver seção 5).
- ✅ Documentos — existem por contrato de fornecedor, não por obra em si (sem um "documentos gerais da obra").

## 13. Etapas e cronograma

- ⚠️ EAP formal — não é uma EAP hierárquica de verdade, é uma lista linear de etapas com `ordem`.
- ✅ Início/término previstos por etapa.
- ⚠️ Duração — calculada implicitamente pela diferença de datas, não é campo próprio.
- ❌ Peso financeiro explícito — implícito via `valor_orcado`, não como percentual configurável separado.
- ✅ Percentual executado por etapa.
- ✅ Valor previsto (`valor_orcado`) e valor realizado (calculado das despesas).
- ⚠️ Gráfico de Gantt — existe (`GanttTimeline`), mas **foi removido da interface** na reestruturação de hoje (decisão do usuário — ficava desconectado do progresso real). As tabelas continuam no banco.
- ✅ Previsto × realizado — Curva S no Cronograma.
- ✅ Atraso — calculado no alerta "etapa atrasada" do WhatsApp (schedule variance).
- ✅ Avanço físico — % executado.
- ✅ Avanço financeiro — Curva S + KPIs.

## 14. Orçamento

- ✅ Orçamento inicial por obra (`orcamento_total`) e por etapa (`valor_orcado`).
- ❌ Separar material / mão de obra / equipamentos / terceirizados dentro do orçamento — não existe essa quebra; o orçamento é só um valor total por etapa.
- ✅ Orçamento por etapa — sim.
- ❌ Orçamento por centro de custo — não existe (sem centro de custo).
- ❌ Orçamento revisado com histórico — quando você edita `valor_orcado`, o valor antigo só sobrevive no log de atividades, não como um "orçamento revisão 2" formal.
- ✅ **Orçado × realizado por material dentro de uma etapa — implementado hoje** (`orcamento_material_etapa`, com quantidade orçada vs realizada).
- ✅ Variação percentual mostrada (barra de progresso com % e alerta visual quando estoura).

## 15. Compras

- ❌ Fluxo formal de compras (solicitação → cotação → aprovação → pedido → recebimento) — **não existe**. O sistema não tem módulo de compras; despesas são lançadas diretamente, já como fato consumado.
- ✅ Associação com obra/etapa/orçamento — sim, mas no nível da despesa já lançada, não de uma "intenção de compra" anterior.

## 16. Aprovações

- ❌ Fluxo `SOLICITADO → EM ANÁLISE → APROVADO → PAGO` — não existe pra despesas em geral.
- ⚠️ Existe algo parecido só pro módulo de **medições** (`preparada → aprovada → paga`), que é sobre liberar pagamento de etapa, não sobre toda despesa.
- ❌ Registrar solicitante/aprovador/justificativa de rejeição — não existe.
- ❌ Limite de aprovação por usuário — não existe (nem faria sentido sem RBAC).

## 17. Dashboard

A maioria das perguntas do checklist **já é respondida** pelo dashboard atual:

- ✅ Quanto já gastamos / quanto estava previsto / saldo restante — sim (Obras, Execução, Cronograma).
- ⚠️ "Quanto temos em contas a pagar" / "quanto vence esta semana" — **não existe** (não há conceito de "conta a pagar" pendente, só despesa já lançada — porque não há módulo de compras/aprovação anterior ao lançamento).
- ✅ Qual obra está estourando orçamento — sim (indicadores visuais nos contratos e KPIs).
- ✅ Qual etapa acima do previsto — sim (orçado x realizado por material, e por etapa).
- ✅ Maiores fornecedores / categorias que mais consomem — sim (breakdown no relatório).
- ✅ Evolução mensal — sim (distribuição mensal físico-financeira, resumo semanal no WhatsApp).
- ❌ Gasto por m² — não existe (não há campo de área da obra).

## 18. Filtros

- ✅ Obra, período, fornecedor, categoria, etapa — todos existem na tela de Lançamentos e no relatório.
- ❌ Empresa / Centro de custo / Status — não existem (conceitos que não existem no modelo).
- ❌ Usuário (quem lançou) como filtro — não existe filtro dedicado (dá pra ver quem lançou na descrição/modal, mas não filtrar por isso).
- ❌ Forma de pagamento como filtro — não existe (não é campo estruturado, ver seção 5).
- ✅ Filtros combináveis — sim, todos os filtros existentes se combinam via query string.

## 19. Pesquisa

- ✅ Busca por descrição, fornecedor, material — campo "Buscar" na tela de Lançamentos.
- ⚠️ Busca por número da NF — só indiretamente (o número do documento existe no comprovante, mas a busca de texto da lista não indexa esse campo especificamente, seria preciso confirmar).
- ❌ Busca global unificada (todos os campos ao mesmo tempo, cross-obra) — o que existe é busca dentro da tela de Lançamentos, não uma busca global do sistema.

## 20. Interface

- ✅ Loading em ações assíncronas (`SubmitButton` com estado pending em quase todo formulário).
- ⚠️ Skeleton em carregamento — não visto um padrão de skeleton screens; usa `loading.tsx` do Next em alguns pontos.
- ✅ Empty states — presentes consistentemente ("Nenhum lançamento encontrado...", etc.).
- ✅ Mensagens de erro claras — nos formulários e no bot.
- ⚠️ Confirmação pra operações críticas — existe pra excluir (modal de confirmação com "detalhesUso"), mas **não existe** pra liberar pagamento fora do fluxo específico que construí hoje.
- ⚠️ Toast de sucesso — não é um padrão consistente; a maioria das ações só revalida a página (sem feedback visual explícito de "sucesso").
- ⚠️ Duplo clique gerando duplicata — o `SubmitButton` desabilita durante `pending`, o que ajuda, mas não é um bloqueio garantido no backend (sem idempotency key no server action).
- ✅ Botão desabilitado durante processamento — sim (`SubmitButton`).
- ❌ Autosave — não existe em lugar nenhum (todo formulário é "salvar explícito").
- ❌ Indicar alterações não salvas — não existe.
- ✅ Responsividade — trabalhada em várias rodadas (tabela de Lançamentos decluttered hoje justamente por isso).
- ⚠️ Tabelas em celular — melhoradas hoje (menos colunas), mas ainda são tabelas com scroll horizontal, não viram cards no mobile.

## 21. Mobile

- ❌ Teste formal em Android/iPhone — não documentado, sem evidência de teste real de dispositivo.
- ✅ Botões grandes o suficiente — trabalhado nas revisões de UI.
- ✅ Upload direto da câmera/galeria — via WhatsApp (que é a via principal em obra) e via `<input type="file">` no dashboard (que abre câmera/galeria nativamente em mobile).
- ✅ WhatsApp como canal principal — é o coração do sistema.
- ⚠️ Tabelas gigantes no celular — parcialmente resolvido hoje, mas ainda são tabelas, não cards dedicados.
- ❌ PWA — não configurado (sem manifest.json, sem service worker).
- ❌ Funcionamento offline — não existe.

## 22. Performance

- ✅ Paginação — existe na tela de Lançamentos (`PorPaginaSelect`).
- ✅ Não carrega tudo de uma vez — `.limit(1000)` nas queries principais, paginação de verdade na tela.
- ⚠️ Server-side filtering — parcial: os filtros vão pra query do Supabase (bom), mas a busca por texto (`busca`) é feita em memória depois de trazer os dados já filtrados.
- ✅ Índices no banco — presentes nas tabelas principais.
- ❌ Lazy loading / code splitting explícito — só o que o Next.js App Router já faz por padrão (não há otimizações manuais adicionais).
- ⚠️ Otimização de imagens — usa `next/image` em alguns pontos (logo), mas comprovantes/fotos de nota não passam por otimização.
- ✅ N+1 já foi caçado e corrigido várias vezes nesta sessão e em commits anteriores (`Promise.all` generalizado, o commit antigo "slow page loads: sequential signed-URL N+1").
- ❌ Cache — não há camada de cache (nem client nem server) além do que o Next.js faz nativamente com `force-dynamic` desabilitando cache na maioria das páginas.

## 23. APIs

- ✅ Autenticação nas rotas que precisam (`/api/despesas/zip`, `/api/despesas/relatorio/pdf` checam `supabase.auth.getUser()`).
- ⚠️ Autorização — binária (logado ou não), sem granularidade.
- ❌ Rate limiting — nenhum, em nenhuma rota (incluindo o webhook do WhatsApp, que só valida assinatura, não frequência).
- ⚠️ Validação de payload — feita manualmente em cada server action (não há um schema validator tipo Zod centralizado).
- ⚠️ Sanitização — confia no Supabase client parametrizado (protege contra SQL injection), mas não há sanitização explícita de texto livre além disso.
- ❌ Versionamento de API — não existe (nem faz muito sentido pro escopo atual).
- ✅ Tratamento de erro nas rotas.
- ⚠️ Logs — só `console.error` pontual, sem logging estruturado (ver seção 28).
- ✅ Idempotência — só no webhook do WhatsApp (dedup por wamid); os server actions do dashboard **não são idempotentes** (reenviar o mesmo form duas vezes cria duplicata).
- ✅ Rotas não vazam dados internos desnecessários (retornos são enxutos).

## 24. Segurança da aplicação

- ✅ SQL Injection — protegido pelo uso do client Supabase parametrizado em 100% das queries (nenhum SQL cru montado por concatenação).
- ✅ XSS — React escapa por padrão; nenhum uso de `dangerouslySetInnerHTML` encontrado.
- ⚠️ CSRF — Server Actions do Next.js têm proteção nativa (origin check), mas não foi customizado/reforçado além disso.
- ⚠️ IDOR / Broken Access Control — como não há RBAC nem isolamento por empresa, tecnicamente **qualquer usuário autenticado pode acessar/editar qualquer obra/despesa** — isso é "por design" pro caso de uso atual (single-tenant), mas seria uma falha grave se o app crescesse pra multiempresa sem resolver isso primeiro.
- ➖ SSRF — não aplicável (o sistema não busca URLs arbitrárias fornecidas por usuário).
- ✅ Upload — validado por MIME type e tamanho (ver seção 10).
- ✅ Secrets — nenhum exposto no client (chaves do Gemini/WhatsApp/Supabase service role só em env vars server-side).
- ❌ CORS — não configurado explicitamente (usa o padrão do Next.js).
- ❌ CSP (Content-Security-Policy) — não configurado em `next.config.ts` nem em middleware.
- ⚠️ Cookies seguros — depende da configuração padrão do `@supabase/ssr`, não customizado manualmente.
- ❌ Auditoria de dependências vulneráveis — não há `npm audit` no fluxo (nem CI pra rodar).

## 25. LGPD e privacidade

- ❌ Política de Privacidade — não existe documento.
- ❌ Informar finalidade dos dados coletados — não existe.
- ⚠️ Controle de acesso a dados pessoais — existe no sentido de "só quem está logado/autorizado acessa", mas sem granularidade LGPD-específica.
- ✅ Log de operações relevantes — a tabela `atividades` cobre isso tecnicamente.
- ❌ Política de retenção de dados — não definida/documentada.
- ❌ Exclusão/anonimização a pedido — soft delete existe, mas não é "exclusão real" nem "anonimização"; dado pessoal (CPF/CNPJ de fornecedor, dados bancários) fica retido indefinidamente.
- ⚠️ Dados desnecessários — o sistema captura bastante dado sensível de fornecedor (CPF, chave Pix, dados bancários) extraído por IA de comprovantes, o que é necessário pro propósito mas aumenta a superfície de exposição.
- ✅ Documentos financeiros protegidos por signed URL (ver seção 10).

## 26. Backup

- ⚠️ Backup automático do banco — depende do plano do Supabase (Free tier: sem PITR, projeto pausa após 7 dias de inatividade — **já alertei sobre isso antes**). Não confirmado/configurado explicitamente por nós.
- ⚠️ Backup de documentos — Supabase Storage tem redundância própria, mas sem backup externo configurado por nós.
- ❌ Backup fora da infraestrutura principal — não existe.
- ❌ Política de retenção documentada — não existe.
- ❌ Teste de restauração — nunca foi feito/documentado.
- ❌ Procedimento de recuperação documentado — não existe.

## 27. Monitoramento

- ❌ Uptime — não monitorado.
- ❌ Erros de frontend/backend — sem Sentry ou equivalente (apontado já duas vezes nesta conversa).
- ❌ Monitorar webhook do WhatsApp — não há dashboard de saúde do webhook, só logs soltos.
- ➖ Filas — não existem filas pra monitorar (ver seção 9).
- ❌ Armazenamento (quota do Storage) — não monitorado.
- ❌ Alertas para falhas críticas — não existem (fora dos alertas *de negócio* que construímos, tipo orçamento estourado).

## 28. Logs

- ⚠️ Respondem "o que aconteceu, quando, quem, em qual obra/registro, por qual canal" — a tabela `atividades` responde bem a isso pras ações do usuário.
- ❌ "Funcionou ou falhou" — não é registrado sistematicamente (erros vão pro `console.error`, que some em produção sem um coletor).
- ✅ Nunca grava senha/token/secret nos logs (não visto nenhuma ocorrência disso no código).
- ❌ Logging estruturado (JSON, níveis, correlação) — não existe; é tudo `console.log`/`console.error` pontual (9 ocorrências no total, conforme auditoria anterior).

## 29. Alertas inteligentes

- ✅ Orçamento ultrapassado — existe (`orcamento_estourado`, comparando contrato x pago).
- ⚠️ Orçamento próximo do limite (antes de estourar) — não existe, só alerta quando já estourou.
- ❌ Pagamento vencido / pagamento alto — não existem (não há conceito de vencimento, ver seção 6/16).
- ✅ **Possível lançamento duplicado — implementado hoje** (nota fiscal repetida).
- ❌ Despesa fora do padrão (anomalia estatística) — não existe.
- ❌ Obra sem movimentação — não existe.
- ❌ Webhook com falha / backup com falha — não existem (não há monitoramento, ver seção 27).

## 30. Relatórios

- ✅ Previsto × realizado — Curva S, orçado x realizado por material.
- ✅ Despesas por obra/etapa/fornecedor/categoria — relatório completo (web + PDF).
- ⚠️ Fluxo de caixa — não existe como relatório dedicado (dá pra montar mentalmente a partir do resumo, mas não é uma tela própria).
- ❌ Contas a pagar — não existe (não há conceito de "a pagar", ver seção 17).
- ✅ Pagamentos realizados — sim (relatório de despesas já é isso).
- ✅ Evolução mensal — sim (distribuição mensal, resumo semanal).
- ✅ Orçamento consumido — sim.
- ✅ Curva S — sim.
- ✅ Físico × financeiro — sim (aba dedicada no Cronograma).
- ✅ Exportação PDF — sim (com logo, KPIs, gráficos, links de documento).
- ⚠️ Exportação Excel — não existe formatação real de planilha (só CSV simples, que abre no Excel mas sem fórmulas/múltiplas abas).
- ✅ CSV — sim.

## 31. Testes automatizados

- ❌ **Nenhum teste automatizado existe** — zero unitário, zero integração, zero E2E. Confirmado hoje (`find` não achou nenhum arquivo `*.test.*` no projeto). Esse é o maior risco estrutural do sistema inteiro.

## 32. Testes de permissões

- ❌ Não existem (consequência direta de não existir RBAC nem multiempresa, e de não existir suíte de testes).

## 33. CI/CD

- ❌ **Nenhum CI configurado** — sem GitHub Actions, sem pipeline. `npm run lint` existe como script, mas `typecheck`/`test` nem estão definidos no `package.json` (rodei `npx tsc --noEmit` manualmente a sessão inteira porque não há script pra isso).
- ❌ Deploy não é bloqueado por lint/typecheck/teste — o Vercel builda e publica direto do push na `main`.

## 34. Migration de banco

- ✅ Migrations usadas consistentemente, com convenção de nome por data.
- ✅ Compatibilidade retroativa cuidadosa — quase toda migration nova é `add column if not exists`, nunca destrutiva.
- ❌ Processo formal de revisão de impacto antes de migration — não existe (sou eu que decido e aplico, sem checklist formal).
- ❌ Backup automático antes de migration — não existe.
- ❌ Testar em staging antes — não existe staging.
- ❌ Rollback documentado — nenhuma migration tem `down`/rollback script.
- ✅ Nunca rodei comando destrutivo direto no banco de produção sem te avisar e pedir pra você aplicar via SQL Editor (isso já é uma prática seguida nesta sessão inteira, mesmo sem estar automatizado).

## 35. Staging

- ❌ Não existe ambiente de staging — só dev local (contra o banco de produção) e produção.

## 36. Health Check

- ❌ Não existe endpoint `/api/health`.

## 37-38. Checklists de deploy / pós-deploy

- ⚠️ Parcialmente seguido de forma manual nesta sessão: typecheck + lint + preview local rodados antes de cada commit grande; mas não é um checklist formal nem automatizado, e "testado em produção depois do deploy" dependeu de você confirmar manualmente algumas vezes.

## 39. Auditoria automática pelo Claude Code

- ❌ Não existem comandos `/audit-*` nem scripts `npm run audit:*` configurados neste projeto.

## 40. Regra de ouro (Dados → Permissões → Financeiro → Auditoria → Segurança → UX → Backup)

Aplicando esse framework ao estado atual:

1. **Dados** — ✅ modelo relacional sólido, `numeric` pra dinheiro, soft delete, FKs.
2. **Permissões** — ❌ o ponto mais fraco do sistema hoje: zero RBAC, zero isolamento multiempresa (aceitável *só* porque é single-tenant real).
3. **Financeiro** — ⚠️ sólido no dia a dia (quantidade, valor unitário, orçado x realizado, duplicidade), mas sem transações atômicas em operações compostas e sem status de ciclo de vida do lançamento.
4. **Auditoria** — ✅ ponto forte: log de atividades cobre a maior parte do sistema com dados antes/depois.
5. **Segurança** — ⚠️ básico coberto (upload, SQL injection, secrets), mas sem rate limiting, sem CSP, sem monitoramento de erro.
6. **UX** — ✅ trabalhado ativamente hoje (ícones, tabela enxuta, responsividade).
7. **Backup** — ❌ não verificado/configurado por nós; depende inteiramente da configuração do plano Supabase.

---

## Resumo executivo — os 5 maiores riscos reais pra produção

1. **Zero testes + zero CI** — qualquer mudança pode quebrar algo sem ninguém saber até o usuário reportar.
2. **Sem rate limiting em lugar nenhum** — login, webhook do WhatsApp e rotas de API estão todos abertos a abuso de volume.
3. **Sem monitoramento de erro/uptime** — se algo quebrar silenciosamente em produção (ex.: webhook do WhatsApp parar de processar), não tem alerta.
4. **Sem transação em operações financeiras compostas** — uma falha no meio de "liberar pagamento" ou "confirmar nota com múltiplos itens" pode deixar dado parcial.
5. **Permissões binárias** — funciona hoje porque é uso pessoal de confiança, mas se mais gente ganhar acesso ao dashboard, não tem trava nenhuma impedindo alguém de apagar a obra errada.

Todo o resto do checklist (RBAC completo, multiempresa, fluxo de compras
com cotação, aprovação por alçada, EAP formal, PWA offline) é
arquitetura de **SaaS multiempresa** — não é "falta implementar", é
"decisão consciente de escopo" pro que o OryonCash é hoje: uma
ferramenta pessoal de controle financeiro de obra, não um ERP
multiempresa. Vale a pena decidir explicitamente se esse é o teto do
produto ou se ele vai crescer pra isso — porque muda a prioridade dos 5
riscos acima.
