# OryonCash — Funcionalidades Pendentes

Lista do que falta para o app ficar redondo, organizada por prioridade.
Reflete o estado atual: bot de WhatsApp (registrar despesa, cadastrar
obra/material/fornecedor, leitura de nota fiscal por foto/PDF) + dashboard
web (login, resumo por obra, categorias/etapas, CRUD básico de
obras/materiais/fornecedores).

## Alta prioridade

- **Editar e excluir despesas** — hoje só dá para criar uma despesa (pelo
  WhatsApp ou implicitamente); não existe tela para ver a lista de despesas
  lançadas, corrigir um valor errado ou apagar um lançamento duplicado.
- **Token de acesso permanente do WhatsApp** — o token atual é de usuário e
  expira/precisa ser regerado periodicamente. Para uso contínuo sem
  manutenção manual, criar um System User no Business Manager e gerar um
  token permanente (`whatsapp_business_messaging` + `whatsapp_business_management`,
  sem expiração).
- **Concluir a Verificação da Empresa no Meta** (Etapa 3) — sem isso o
  envio de mensagens pode continuar instável/bloqueado esporadicamente.
- **Editar/excluir obras, materiais e fornecedores** — as telas atuais só
  cadastram e listam; falta poder corrigir um nome errado, encerrar uma
  obra (marcar como "concluída") ou remover um fornecedor duplicado.
- **Tela de gestão de Categorias e Etapas** — essas tabelas existem e são
  usadas o tempo todo, mas não têm nenhuma tela no dashboard (só dá para
  editar direto no Supabase).

## Média prioridade

- **Comando de resumo mais rico pelo WhatsApp** — hoje "Ver Resumo" manda
  só um texto fixo. Seria útil responder perguntas livres tipo "quanto
  gastei em material esse mês" ou "lista de compras da obra X".
- **Anexar o comprovante/nota fiscal à despesa** — quando o bot lê uma nota
  fiscal, os dados são extraídos mas a imagem/PDF original não fica salva
  em lugar nenhum. Guardar o arquivo (Supabase Storage) e linkar na
  despesa evita ter que procurar a nota física depois.
- **Alerta de orçamento estourado** — avisar (pelo WhatsApp ou no
  dashboard) quando o gasto de uma obra ultrapassa X% do orçamento.
- **Cronograma real por obra** — hoje "Etapas" é um catálogo genérico sem
  datas. Para o "cronograma de tempo" mencionado no pedido original,
  cada obra precisaria de datas de início/fim previstas por etapa, com
  indicador visual de atraso.
- **Exportar relatórios** (PDF/Excel) — útil para prestar contas ou levar
  ao contador; hoje os dados só existem dentro do dashboard.
- **Recuperação de senha pelo próprio app** — hoje só dá para trocar senha
  direto no painel do Supabase. Uma tela de "esqueci minha senha" no
  próprio login evita depender do Supabase Studio.

## Baixa prioridade / polimento

- **Cancelar/editar uma despesa direto pelo WhatsApp** ("apagar o último
  lançamento", "mudar o valor da última despesa").
- **Múltiplos usuários por obra** (ex.: um sócio ou mestre de obras
  também podendo registrar despesas) — hoje só um número autorizado.
- **Notificações push/e-mail** de resumo semanal automático.
- **Testes automatizados** (unitários para o motor de conversas do bot,
  E2E para o dashboard) — hoje a validação é só manual.
- **Onboarding do bot** — uma mensagem de boas-vindas explicando os
  comandos na primeira conversa de um número novo.
- **Acessibilidade e responsividade mobile** do dashboard — já funciona,
  mas não foi testado a fundo em telas pequenas.

## Fora de escopo por enquanto (decisão já tomada)

- Multi-tenant / cobrança por plano (uso é pessoal, não produto vendido).
- Interpretação por IA de texto livre no bot (fluxo é guiado por
  listas/botões, por escolha do usuário).
