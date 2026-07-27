# OryonCash — Funcionalidades Pendentes

Lista do que falta para o app ficar redondo, organizada por prioridade.
Atualizada em 2026-07-27 — a versão anterior estava desatualizada: editar/
excluir despesas, obras, materiais e fornecedores, tela de Categorias,
anexo de comprovante, log de auditoria e lixeira já foram implementados
desde então.

## Alta prioridade

- **Concluir a Verificação da Empresa no Meta** (Etapa 3 do onboarding do
  WhatsApp) — sem isso o envio de mensagens pode continuar
  instável/bloqueado esporadicamente.
- **`entidade_id` na tabela `atividades`** — o log de auditoria guarda só
  um texto-resumo, sem o id do registro alterado. Sem isso não dá para
  linkar cada atividade direto pro lançamento/obra/etc. específico (só dá
  pra filtrar por tipo/entidade, não abrir o item exato).
- **Deduplicar fornecedores/materiais cadastrados pelo WhatsApp** — hoje
  já existem cadastros duplicados (ex.: o mesmo fornecedor criado 2-3x com
  nomes quase iguais) porque o bot cria um novo registro sempre que o
  texto não bate exatamente. Precisa de correspondência aproximada (ou
  confirmação "já existe esse, quer usar?") antes de criar um novo.

## Média prioridade

- **Comando de resumo mais rico pelo WhatsApp** — hoje "Ver Resumo" manda
  só um texto fixo. Seria útil responder perguntas tipo "quanto gastei em
  material esse mês" ou "lista de compras da obra X".
- **Alerta ativo de orçamento estourado** — hoje só existe indicação
  visual (badge) quando você está olhando o dashboard; não existe aviso
  proativo (WhatsApp ou e-mail) no momento em que o orçamento estoura.
- **Cronograma real por obra** — "Etapas" tem `valor_orcado` mas não datas
  de início/fim previstas nem indicador de atraso (a obra em si tem
  `data_inicio`, mas nada por etapa).
- **Exportar relatório em Excel (.xlsx) de verdade** — hoje o relatório
  visual tem impressão/PDF e um CSV simples; não existe uma planilha
  formatada (várias abas, fórmulas, etc.) pra levar ao contador.
- **Recuperação de senha pelo próprio app** — hoje só dá para trocar senha
  direto no painel do Supabase.

## Baixa prioridade / polimento

- **Cancelar/editar uma despesa direto pelo WhatsApp** ("apagar o último
  lançamento", "mudar o valor da última despesa") — hoje precisa passar
  pelo fluxo guiado "Corrigir Lançamento".
- **Múltiplos usuários por obra** com papéis diferentes (ex.: um mestre de
  obras só registra despesa, não vê financeiro completo) — hoje todo
  número autorizado tem acesso igual.
- **Notificações push/e-mail** de resumo semanal automático.
- **Testes automatizados** (unitários para o motor de conversas do bot,
  E2E para o dashboard) — hoje a validação é só manual.
- **Onboarding do bot** — mensagem de boas-vindas explicando os comandos
  na primeira conversa de um número novo.
- **Acessibilidade e responsividade mobile** do dashboard — já funciona e
  foi ajustado várias vezes (cabeçalho, tabelas), mas não passou por uma
  auditoria formal de acessibilidade.

## Fora de escopo por enquanto (decisão já tomada)

- Multi-tenant / cobrança por plano (uso é pessoal, não produto vendido).
- Interpretação por IA de texto livre no bot (fluxo é guiado por
  listas/botões, por escolha do usuário).
- Integração com o "Oryon ERP" (Firebase) maior — adiada explicitamente.
