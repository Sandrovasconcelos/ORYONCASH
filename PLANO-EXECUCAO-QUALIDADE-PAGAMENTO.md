# Plano — Unificação de Qualidade, Progresso e Liberação de Pagamento

Documento de especificação. Objetivo: eliminar a fragmentação atual (página
Qualidade + página Cronograma com 4 abas, fluxo de pagamento em 3 cliques
separados) e substituir por uma tela única por etapa, onde o usuário resolve
qualidade, progresso e liberação de pagamento sem trocar de página.

Este documento é o contrato antes de qualquer linha de código. Toda decisão
de comportamento está explícita aqui — inclusive as que preciso que você
confirme antes de eu começar (seção 8).

---

## 1. Diagnóstico — por que hoje é confuso

Uma mesma etapa tem **três indicadores de progresso** que não se conectam:

| Indicador | Onde fica | Quem alimenta | Pra que serve hoje |
|---|---|---|---|
| `percentual_executado` | Cronograma → Visão geral, modal "Atualizar progresso" | Número digitado à mão | Elegibilidade de medição + Curva S |
| `situacao_qualidade` | Qualidade → inspeção por checklist | Resultado da inspeção (pior resposta manda) | Elegibilidade de medição (só libera se "aprovado") |
| Fases/atividades do Detalhado | Cronograma → aba Detalhado | Status manual por atividade (a_fazer/em_andamento/concluída) | **Nada** — tem seu próprio % que não alimenta os outros dois |

E o fluxo de liberação de pagamento precisa de **3 cliques manuais em
sequência**, na aba Medições: "Preparar medição" → "Aprovar" → "Registrar
pagamento" — cada um um formulário/botão separado, sem confirmação de valor
no meio.

Resultado: pra liberar o pagamento de uma etapa, o caminho hoje é:
Qualidade (vincular checklist + inspecionar) → Cronograma/Visão geral
(digitar % executado) → Cronograma/Medições (preparar → aprovar → pagar).
Cinco telas/ações diferentes pra uma operação que é conceitualmente uma
coisa só: "essa etapa avançou, está aprovada, libera o que é devido".

---

## 2. Decisões de conceito

Isso é o que muda de verdade — a reestruturação de tela é consequência
disso, não o contrário.

### 2.1 Progresso físico — continua sendo o `% executado` manual

Fica como única fonte de verdade de "quanto da etapa está pronto". Não vai
ser calculado a partir de checklist nem das atividades do Detalhado — os
dois ficam informativos, sem gerar número.

**Por quê:** o % executado é a unidade que casa com o valor orçado pra
calcular quanto pagar (`valor_orcado × %`). Checklist é qualitativo
(aprovado/pendente/reprovado), não dá um percentual. Fases/atividades detalhado
teria que existir em toda etapa pra virar fonte confiável, e hoje é opcional.

### 2.2 Checklist de qualidade — continua sendo o portão (gate), mas o histórico fica visível

Uma etapa só libera pagamento se a última inspeção for "aprovado". Isso não
muda. O que muda: hoje só se vê a *situação atual* (um badge); no novo
desenho, dentro da etapa dá pra ver o **histórico de inspeções** (datas,
quem inspecionou, resultado, evidências anexadas) sem precisar ir em
"Atividades".

### 2.3 Cronograma Detalhado (fases/atividades) — vira 100% informativo

Deixa de ter qualquer relação com liberação de pagamento ou com o %
executado. Vira só uma ferramenta de planejamento visual (Gantt + contagem
de atividades por status) pra quem quiser quebrar a etapa em tarefas
menores e acompanhar visualmente. Continua existindo, só some a expectativa
de que ele "significa" alguma coisa pro financeiro.

**Isso é uma pergunta em aberto — ver seção 8.1.** Se vocês não usam essa
aba, a alternativa é remover de vez em vez de só desconectar.

### 2.4 Liberação de pagamento — de 3 cliques pra 1, por etapa

Hoje "medição" é sempre em lote (escolhe categoria + período, sistema junta
todas as etapas elegíveis daquele momento numa medição só, com 3 status
sequenciais). Isso é útil quando você quer fechar um período com várias
etapas de uma vez — mas é overkill quando você só quer liberar o pagamento
de UMA etapa específica que acabou de ser aprovada.

**Novo modelo — dois caminhos, mesma base de dados:**

- **Liberação rápida (novo, é o caminho principal)** — dentro da própria
  etapa, um botão "Liberar pagamento" que calcula o valor devido, mostra
  pra confirmar, e no clique de confirmar já cria a medição, aprova e paga
  — tudo de uma vez (internamente ainda gera `medicoes` + `medicao_itens` +
  `despesas`, só que numa ação só, sem os 3 status intermediários visíveis
  pro usuário).
- **Medição de período (mantido, pra fechamento em lote)** — continua
  existindo pra quem quiser juntar várias etapas elegíveis num período e
  fechar de uma vez (ex.: fechamento mensal com o fornecedor). Fica com 2
  passos em vez de 3: "Preparar" (junta as etapas elegíveis) → "Aprovar e
  pagar" (um botão só, já que não existe separação de quem aprova e quem
  paga nesse app — é uso pessoal, um número de WhatsApp autorizado tem
  acesso igual a todos, conforme já registrado no ROADMAP).

Nenhuma tabela nova é necessária — `medicoes`, `medicao_itens`, `despesas`,
`inspecoes` continuam do jeito que estão. O que muda é o *server action* que
orquestra: em vez de 3 handlers chamados em momentos separados pelo
usuário, a liberação rápida chama a mesma lógica em sequência dentro de uma
única function.

### 2.5 Categoria da medição — precisa de um valor padrão pra não travar o clique único

Hoje toda medição pede uma categoria (usada nas despesas geradas). Pra
liberação em 1 clique funcionar sem abrir formulário, a obra precisa ter
uma **categoria padrão de medição** configurável (um campo novo,
opcional, na tela de Obras). Se não tiver padrão definido, a liberação
rápida abre um mini-formulário pedindo só a categoria (1 campo) antes de
confirmar — nunca trava sem explicação.

---

## 3. Nova navegação

```
Obra
 ├─ Obras                 (sem mudança — cadastro de obra e etapas)
 ├─ Execução               ← NOVA, substitui "Qualidade"
 └─ Cronograma             (mantido, mais enxuto — ver seção 5)
```

O item "Qualidade" some do menu. "Execução" entra no lugar (mesma posição),
ícone `check` (o mesmo que Qualidade usa hoje).

---

## 4. Tela "Execução" — nova página (`/dashboard/execucao`)

Substitui a página Qualidade inteira e absorve: a tabela de etapas +
"Atualizar progresso" que hoje está em Cronograma → Visão geral, e a aba
Medições inteira de Cronograma.

### 4.1 Cabeçalho

- **Seletor de obra** — mesmo componente `ObraSelector` já usado em todo
  canto (dropdown com as obras não excluídas).
- **Botão "Gerenciar checklists"** (canto superior direito, estilo
  secundário) — abre modal largo com a mesma função que hoje é a aba
  "Modelos" dentro de Qualidade: criar/editar/excluir modelos de checklist
  e seus itens. Conteúdo idêntico ao que já existe hoje (nome, descrição,
  lista de itens com ordem e crítico) — só muda de "aba" pra "modal", igual
  já acontece com "Gerenciar modelos" de cronograma.
- **Botão "Configurar categoria padrão"** — atalho pra editar o campo novo
  de categoria padrão de medição da obra (ver 2.5), só aparece se a obra
  ainda não tiver uma definida. Some depois de configurado (mas continua
  editável dentro do cadastro da obra).

### 4.2 KPIs (linha de 4 cartões, iguais ao padrão `KpiTile` já usado)

1. **Orçamento total** da obra
2. **Executado (financeiro)** — soma de despesas, igual já é hoje
3. **% físico médio** — igual ao cálculo atual (ponderado por valor_orcado)
4. **A liberar** (novo) — soma em R$ do que está aprovado na qualidade e
   com % executado acima do já pago, somando todas as etapas da obra. É o
   número que responde "quanto eu já poderia estar pagando e ainda não
   liberei". Substitui o atual "Medições em aberto" (que contava medições
   status ≠ paga, uma métrica menos direta).

### 4.3 Tabela de etapas

Uma linha por etapa da obra selecionada, ordenada por `ordem` (igual hoje).

| Coluna | Conteúdo |
|---|---|
| Etapa | Nome |
| Fornecedor | Nome do fornecedor vinculado, ou "—" |
| Progresso | Barra de % executado + número (ex: `▓▓▓▓▓░░░░░ 52%`) |
| Qualidade | Badge colorido: cinza "Não inspecionado", verde "Aprovado", amarelo "Pendente", vermelho "Reprovado" (mesmas cores/labels de hoje) |
| Pago | Badge com % já pago da etapa + valor em R$ embaixo (mesma lógica visual que já existe na tabela de Qualidade hoje) |
| A liberar | Valor em R$ que está pronto pra liberar agora (0 se não há nada elegível) — em destaque (vermelho/negrito) quando > 0, pra chamar atenção |
| Ações | Botão único **"Abrir etapa"** |

Linha vazia: "Nenhuma etapa cadastrada para esta obra." com link pra Obras
(igual ao padrão de empty state já usado nas outras telas).

### 4.4 Botão "Abrir etapa" → drawer/modal largo (`modalSize="wide"`)

Um modal único por etapa, com **4 seções internas empilhadas verticalmente**
(não abas dentro do modal — scroll vertical, pra evitar modal-dentro-de-modal
e manter tudo visível/buscável com Ctrl+F). Título do modal: nome da etapa.
Subtítulo: nome da obra.

#### Seção A — Configuração

Cartão com os campos abaixo, cada um com seu próprio botão "Salvar" (não
um formulário gigante só — assim salvar o fornecedor não obriga preencher
data, por exemplo):

- **Fornecedor responsável** — select com todos os fornecedores da obra +
  "Nenhum". Salvar chama a mesma lógica de `vincularChecklistEtapaAction`
  (mantém `checklist_template_id` atual, só atualiza `fornecedor_id`).
- **Checklist vinculado** — select com os modelos cadastrados (via
  "Gerenciar checklists") + "Nenhum". Mesmo action.
- **Datas previstas** — dois campos de data (início/fim previstos), lado a
  lado. Igual ao formulário "Atualizar progresso" de hoje, só que sem o
  campo de %, que vira a seção B.
- Se a etapa tiver um contrato de fornecedor vinculado (`contratos_fornecedor.etapa_id`),
  mostra um aviso somente-leitura: "📄 Contrato: R$ X — [ver arquivo]" —
  mesma informação que já aparece na tabela de Qualidade hoje, só que
  dentro do drawer em vez de numa coluna da tabela.

#### Seção B — Progresso

- **% executado** — input numérico (0–100) com o valor atual, mais um
  slider visual abaixo espelhando o número (opcional, mas ajuda a não
  digitar errado). Botão "Salvar progresso". Mesma validação de hoje
  (clamp 0–100).
- Abaixo, uma linha de texto mostrando o resultado do cálculo em tempo
  real (sem precisar salvar pra ver): "Com esse %, dá pra liberar R$ X
  (Y%) — sujeito à qualidade estar aprovada." Isso é só leitura visual
  (client-side), recalculado a cada tecla, não grava nada sozinho.

#### Seção C — Qualidade

- **Situação atual**: badge grande igual ao da tabela.
- **Histórico de inspeções** — lista (mais recente primeiro) com: data,
  resultado (badge), quem inspecionou, observação (se houver), e miniaturas
  ou ícones de evidências anexadas (clicáveis, abrem em nova aba via signed
  URL — igual já funciona hoje pra outros anexos do sistema). Isso é novo:
  hoje só a inspeção mais recente é visível através do `situacao_qualidade`
  da etapa; o histórico completo (tabela `inspecoes` + `inspecao_respostas`)
  já existe no banco mas não tem tela nenhuma mostrando.
- **Botão "Nova inspeção"** — mesmo formulário de hoje (lista os itens do
  checklist vinculado, cada um com select aprovado/pendente/reprovado/não
  se aplica, campo de observação geral, campo "inspecionado por", upload de
  evidências). Se não houver checklist vinculado, o botão fica desabilitado
  com tooltip "Vincule um checklist na Configuração primeiro" (igual ao
  comportamento atual).

#### Seção D — Pagamento

- **Resumo**: "Já pago: R$ X (Y%) · Contrato: R$ Z" (se houver contrato
  vinculado) — mesmas informações que hoje ficam espalhadas entre a coluna
  "Pago" da tabela de Qualidade e a tabela de Contratos do Cronograma.
- **Botão "Liberar pagamento"** — só fica habilitado quando: qualidade =
  aprovado, fornecedor vinculado, e valor a liberar > 0. Quando desabilitado,
  mostra o motivo abaixo do botão em texto pequeno (ex.: "Qualidade
  pendente — inspecione a etapa primeiro" ou "Nenhum valor novo a
  liberar").
  - Ao clicar (habilitado): abre um mini-passo de confirmação dentro da
    mesma seção (não um modal novo) mostrando: percentual a liberar, valor
    em R$, fornecedor, e o select de categoria (pré-preenchido com a
    categoria padrão da obra se existir, editável). Botão "Confirmar
    liberação" e "Cancelar".
  - Ao confirmar: roda a nova ação `liberarPagamentoEtapaAction` — cria a
    medição já com status `paga` (sem passar por preparada/aprovada
    visíveis ao usuário), cria o `medicao_itens`, gera a `despesa`
    vinculada, tudo numa transação/sequência só, e registra 1 atividade de
    auditoria com o resumo já consolidado ("Pagamento de R$ X liberado
    para a etapa Y (Z%) por AUTOR").
  - Depois de confirmado: a seção mostra "Pago: R$ X" atualizado e um link
    "Ver detalhes desta liberação" que expande os mesmos dados que hoje
    aparecem no `<details>` da tabela de Medições (período, itens).
- **Histórico de liberações da etapa** — lista (mais recente primeiro) das
  medições que incluíram essa etapa, com data, valor, e se veio de
  "liberação rápida" ou de uma "medição de período" (rótulo distinguindo a
  origem, pra rastreabilidade).

---

## 5. Tela "Cronograma" — mantida, porém mais enxuta

Perde a tabela de etapas (que virou parte de Execução) e a aba Medições
inteira (que virou a Seção D de cada etapa + a sub-tela "Medições do
período", ver seção 6). Fica com 3 abas em vez de 4:

### 5.1 Aba "Visão geral"
- KPIs de obra (orçamento, executado, % físico) — sem a métrica "Medições
  em aberto" (que já não existe mais nesse formato).
- Curva S — sem mudança.
- Tabela de Contratos de fornecedores — sem mudança nenhuma (criar, editar,
  excluir contrato, upload de arquivo assinado, vínculo opcional a etapa).

### 5.2 Aba "Detalhado"
- Sem mudança de funcionalidade (modelos reutilizáveis, fases, atividades,
  Gantt, gráfico de status). Só muda o entendimento: deixa de ser
  confundido com "% executado real" — vira puramente uma ferramenta de
  planejamento/visualização. Se a decisão da seção 8.1 for remover, essa
  aba inteira sai do Cronograma.

### 5.3 Aba "Físico-financeiro"
- Sem mudança (tabela de distribuição mensal por etapa).

---

## 6. Sub-tela "Medições do período" (fluxo em lote)

Deixa de ser uma aba fixa do Cronograma e passa a ser um modal acessível a
partir da tela Execução (botão secundário "Medição de período" no
cabeçalho, ao lado de "Gerenciar checklists"). Conteúdo:

- **Botão "+ Preparar medição"** — mesmo formulário de hoje (categoria +
  período + observação). Ao confirmar, roda a mesma lógica de
  `prepararMedicaoAction` (junta todas as etapas elegíveis no momento:
  qualidade aprovada + fornecedor + % novo desde a última medição).
- **Lista de medições** — mesma tabela de hoje (período, categoria, status,
  valor, itens expansíveis por `<details>`), com uma mudança: quando o
  status é "preparada", o botão de ação passa a ser **"Aprovar e pagar"**
  (um só, em vez dos dois botões separados de hoje) — ele roda em sequência
  a mesma lógica de `aprovarMedicaoAction` + `registrarPagamentoMedicaoAction`
  numa ação só.
- Editar e excluir medição — sem mudança de comportamento (inclusive o
  aviso de que excluir uma medição paga manda a despesa gerada pra
  lixeira).

---

## 7. O que NÃO muda

- Nenhuma tabela do banco é removida. `medicoes`, `medicao_itens`,
  `inspecoes`, `inspecao_respostas`, `inspecao_evidencias`,
  `checklist_templates`, `checklist_itens`, `obra_cronograma_fases`,
  `obra_cronograma_atividades`, `etapa_distribuicao_mensal` continuam
  todas exatamente como estão.
- Cadastro de etapa (nome, ordem, valor orçado) continua sendo feito na
  tela Obras — Execução só consome etapas já criadas, não duplica esse
  CRUD.
- Contratos de fornecedores continuam 100% dentro de Cronograma → Visão
  geral, sem mudança de campos ou comportamento.
- Curva S, distribuição mensal físico-financeira: sem mudança.
- Regra de elegibilidade pra medição continua a mesma: qualidade aprovada +
  fornecedor vinculado + delta de % positivo.
- Nenhum dado histórico é perdido ou precisa de migração — é só
  reorganização de telas + duas ações novas que reaproveitam as
  existentes por baixo.

---

## 8. Perguntas em aberto — preciso da sua confirmação antes de codar

### 8.1 O que fazer com o Detalhado (fases/atividades)? — ✅ CONFIRMADO

**Decisão: (b) Remover completamente da interface.** As tabelas
(`obra_cronograma_fases`, `obra_cronograma_atividades`,
`cronograma_templates` e afins) continuam intactas no banco — só saem de
vista (menu, abas, formulários). Reversível depois se precisar.

**Efeito colateral que isso causa e que precisa ser corrigido junto** — o
alerta de WhatsApp "etapa atrasada" (`lib/alertas/queries.ts`,
`buscarEtapasAtrasadas`) hoje calcula atraso a partir das **fases do
Detalhado** (`obra_cronograma_fases.data_inicio_prevista/data_fim_prevista`
+ status das atividades), não a partir da etapa em si. Removendo o
Detalhado, esse alerta perde a fonte de dados. Ele precisa ser reescrito
pra usar `etapas.data_inicio_prevista`/`data_fim_prevista` +
`percentual_executado` (que já existem e são o novo padrão único, decisão
2.1) em vez das fases detalhadas. Isso entra no escopo deste plano, seção
9 (ordem de implementação).

### 8.2 Nome das liberações rápidas no histórico — ✅ CONFIRMADO

**Decisão: aparecem como "Liberação #123"**, distintas das medições de
período no histórico (rótulo de origem visível, conforme já previsto na
seção 4.4).

### 8.3 Nome do campo de categoria padrão — ✅ CONFIRMADO

**Decisão: "Categoria padrão para pagamentos de etapas"**, campo na tela
de Obras.

### 8.4 Notificações WhatsApp — expandido, ver seção 10

A pergunta original (se o KPI "A liberar" devia virar aviso proativo)
virou um pedido bem mais amplo: notificação em tempo real por
lançamento, resumo diário às 22h, resumo semanal, e relatórios com imagem
pelo WhatsApp. Está detalhado à parte na seção 10, com suas próprias
perguntas em aberto — é grande o suficiente pra merecer o mesmo tratamento
que o resto deste documento.

---

## 9. Ordem de implementação sugerida (depois de confirmado)

1. Novo server action `liberarPagamentoEtapaAction` (reaproveita a lógica
   de `calcularItensElegiveisParaMedicao` já existente, só que para 1
   etapa) + campo `categoria_medicao_padrao_id` na tabela `obras`
   (migration pequena).
2. Página `/dashboard/execucao` (tabela + drawer com as 4 seções).
3. Mover "Gerenciar checklists" pra dentro dela (reaproveita componente
   já existente da atual página Qualidade).
4. Enxugar `/dashboard/cronograma` (remover tabela de etapas duplicada e
   aba Medições, criar o modal "Medições do período").
5. Atualizar `aprovarMedicaoAction`/`registrarPagamentoMedicaoAction` pra
   uma versão combinada "Aprovar e pagar".
6. Remover item "Qualidade" do menu, adicionar "Execução".
7. Reescrever `buscarEtapasAtrasadas` (`lib/alertas/queries.ts`) pra usar
   `etapas.data_inicio_prevista/data_fim_prevista/percentual_executado` em
   vez das fases do Detalhado (consequência da decisão 8.1).
8. Remover o menu/abas do Detalhado (decisão 8.1).

---

## 10. Expansão de notificações WhatsApp (a partir da pergunta 8.4)

### 10.1 O que existe hoje

- Uma tabela só, `configuracoes_notificacao`, com **um único número de
  WhatsApp** de destino e 3 toggles (atraso de etapa, orçamento estourado,
  saldo negativo).
- Um cron único (`vercel.json`), roda **11h UTC = 08h no horário de
  Brasília**, chama `/api/cron/notificacoes` → `enviarNotificacaoDiaria()`
  → monta os alertas ativos e manda um texto simples pro número
  configurado. Só dispara se houver algo pra reportar (nunca manda "nada
  aconteceu hoje").
- `lib/whatsapp/messages.ts` hoje só tem `sendText`, `sendList`,
  `sendButtons` — **não existe função pra mandar imagem, PDF ou outro
  documento pelo WhatsApp**. Isso precisa ser criado do zero (a API do
  WhatsApp Cloud suporta enviar mídia por URL pública ou por upload prévio
  — nenhum dos dois está implementado ainda).
- Cadastro de números autorizados a *usar* o bot (`usuarios_whatsapp`) é
  uma tabela separada do número que *recebe notificação* — hoje só um
  número recebe notificação, mesmo que vários estejam autorizados a lançar
  despesas.

### 10.2 O que você pediu, quebrado em 4 pedaços

1. **Resumo semanal** de quanto foi gasto.
2. **Resumo diário, às 22h**, detalhado por conta e por etapa.
3. **Notificação em tempo real a cada lançamento** — tanto quando você
   lança quanto quando o Leonardo lança — chegando no seu WhatsApp.
4. **Relatórios com imagem** mandados pelo WhatsApp (não só texto).

### 10.3 Como cada pedaço se encaixa no que já existe

#### (1) Resumo semanal
Novo cron (`vercel.json` aceita múltiplos crons) + nova função
`enviarResumoSemanal()`, parecida com a diária de hoje, mas somando
despesas dos últimos 7 dias por obra. Dia/hora pra rodar — ver pergunta
10.4.a.

#### (2) Resumo diário às 22h, detalhado por conta e etapa
Isso é diferente do cron atual (que manda só *alertas*, não um resumo do
que foi gasto). Vira uma segunda função nova, `enviarResumoDiario()`,
rodando num cron à parte agendado pra **01h UTC** (22h de Brasília),
somando as despesas do dia agrupadas por **conta bancária** e por
**etapa**, com subtotal de cada uma e o total geral do dia. Se não houve
nenhum lançamento no dia, ainda assim dispara (diferente do alerta atual,
que só manda se houver algo) — ver pergunta 10.4.b pra confirmar se é isso
mesmo que você quer, ou se prefere que fique em silêncio nos dias sem
movimento.

#### (3) Notificação em tempo real por lançamento (seu + do Leonardo)
Precisa de um "gancho" (hook) toda vez que uma despesa é criada — e despesa
é criada em **dois lugares diferentes no código**: pelo bot do WhatsApp
(`lib/conversation/queries.ts`, quando alguém lança por lá) e pelo painel
(`app/dashboard/actions.ts`, quando é lançado direto pela tela). Os dois
precisam chamar a mesma função nova `notificarLancamento(despesa)`, que
manda um texto curto ("💸 Novo lançamento — R$ X em Material, obra Y, por
Leonardo") pro seu número.
**Detalhe importante:** se você mesmo lançar pelo WhatsApp, essa notificação
chegaria pro seu próprio número também (redundante, você acabou de ver a
confirmação do bot). Pergunta 10.4.c resolve isso: notificar só quando
quem lançou **não** é você, ou sempre, sem distinção?

#### (4) Relatórios com imagem
Dois caminhos possíveis, bem diferentes em esforço:
- **(i) Mandar o PDF do relatório já existente como documento anexado** —
  o relatório em PDF com papel timbrado já existe (rota de
  despesas/relatório); só falta a função `sendDocument` no
  `lib/whatsapp/messages.ts` e um botão/comando que dispara o envio.
  Esforço menor, reaproveita 100% do que já existe.
- **(ii) Gerar uma imagem (gráfico/resumo visual) e mandar como foto** —
  exigiria montar uma imagem nova (ex.: renderizar um card com os números
  do dia/semana como PNG) só pra mandar pelo WhatsApp. Mais trabalho, mais
  bonito no chat.
Pergunta 10.4.d define qual dos dois (ou os dois).

### 10.4 Decisões (você pediu pra decidir da melhor forma — aqui está o
critério de cada uma)

**a) Resumo semanal — segunda-feira, 07h (Brasília).**
Fecha a semana anterior (segunda a domingo). Fica antes do expediente
começar, pra você já abrir a semana sabendo quanto foi gasto na anterior,
e num horário diferente do resumo diário (não compete com ele).

**b) Resumo diário às 22h — manda sempre, mesmo sem lançamento nenhum.**
Um app de controle financeiro que fica calado é indistinguível de um app
quebrado. Nos dias sem movimento a mensagem é curta ("Nenhum lançamento
hoje"), mas confirma que o sistema está de pé.

**c) Notificação em tempo real — só quando quem lançou não foi você.**
Evita redundância (você não precisa de aviso de algo que acabou de fazer e
já viu confirmado na hora). Continua avisando sempre que for o Leonardo (ou
qualquer outro número autorizado) lançando.

**d) Relatório com imagem — começa pelo caminho (i): manda o PDF já
existente como anexo.**
Reaproveita 100% do relatório com papel timbrado que já existe — é a opção
que entrega valor real sem inventar um sistema de geração de imagem do
zero. A opção (ii) (cartão-resumo visual gerado sob medida pro WhatsApp)
fica registrada no ROADMAP como melhoria futura, não entra neste pacote.

**e) Todas as notificações novas vão pro mesmo número já configurado em
Configurações — sem roteamento por pessoa por enquanto.**
É a extensão mais simples do que já existe (`configuracoes_notificacao`
já tem exatamente um número). Multi-destinatário com regras por tipo de
aviso é um recurso a mais (nova tabela, nova tela) que não foi pedido
explicitamente — fica anotado como possível próximo passo se você sentir
falta, mas não faz parte deste pacote pra não inflar o escopo.
