# Insights e Alertas — nova visão "Por cliente"

Adicionar um segundo modo de visualização na seção "Insights e Alertas" do Dashboard, mantendo a visão atual intacta como opção.

## Toggle de visão

No topo do card: `[ Por orçamento ] [ Por cliente ]`. A visão atual (lista por insight) continua igual; a nova visão agrupa por vendedor e cliente.

## Métricas do topo (visão por cliente)

Quatro blocos rápidos calculados sobre os itens em aberto já filtrados pelo período/consultor global:
Total em aberto (R$) · Clientes únicos · Alertas críticos · Atenções.

## Nível 1 — Card por vendedor (accordion)

Nome do vendedor, nº de clientes únicos, contagem de alertas e atenções, soma total em aberto, botão expandir/recolher com animação. Itens marcados como "cobrado" saem das contagens de alerta/atenção do card.

## Nível 2 — Linha por cliente

Tabela (cards empilhados no mobile) com: cliente, data do último orçamento, dias parado, valor total em aberto, nº de orçamentos, status predominante (vermelho se houver qualquer alerta, senão amarelo) e botão "Cobrar devolutiva".

Ordenação automática por prioridade:

```text
CRÍTICO  = alerta + mais de 10 dias
URGENTE  = alerta + 5 a 9 dias
ATENÇÃO  = rascunho + mais de 5 dias
NORMAL   = menos de 5 dias
```

## Nível 3 — Detalhe do cliente

Clique na linha expande inline os orçamentos individuais daquele cliente: número, valor, motivo/dias e botão "Ver orçamento" (mesma navegação já usada hoje: `/orcamentos?focus=...`).

## Modal "Cobrar devolutiva"

Cabeçalho com cliente, vendedor, data e valor do último orçamento. Mensagem de cobrança gerada automaticamente em textarea editável, botão "Copiar mensagem" (feedback "Copiado! ✓" por 2s), campo de observação livre do gestor e botão "Marcar como cobrado". A linha cobrada fica acinzentada com ✅ e timestamp, e continua visível.

## Filtros adicionais (apenas na visão por cliente)

Mantém "Todos os tipos" e acrescenta: vendedor, status (Todos / Alerta / Atenção / Cobrados hoje), período (7 / 15 / 30 dias) e valor mínimo.

## Detalhes técnicos

- Novos tipos `ClienteEmAberto` e `VendedorAgrupado` em `src/types/dashboard.ts`.
- Nova função de agregação em `src/lib/insightsPorCliente.ts`: recebe `InsightDashboard[]` e agrupa por consultor → nome do cliente. Para isso, `useDashboardComercial.ts` passa a preencher nos insights de pedido/orçamento campos estruturados já disponíveis (`cliente`, `valor`, data de referência, `dias_parado`, `orcamento_id`, `numero_orcamento`), acrescentando esses campos ao tipo `InsightDashboard` — sem alterar as mensagens nem a visão atual.
- Novos componentes: `src/components/dashboard/InsightsPorCliente.tsx` (métricas + accordion por vendedor + tabela) e `CobrarDevolutivaDialog.tsx`; `DashboardInsights.tsx` ganha só o toggle e a renderização condicional.
- Estado "cobrado" persistido em `localStorage` (chave por vendedor+cliente, com timestamp e observação). Sem mudanças no banco.
- Agrupamento por nome de cliente normalizado (trim + caixa) para evitar duplicidade.
- Componentes shadcn já presentes: Accordion, Table, Dialog, Textarea, Badge, Select, Input.