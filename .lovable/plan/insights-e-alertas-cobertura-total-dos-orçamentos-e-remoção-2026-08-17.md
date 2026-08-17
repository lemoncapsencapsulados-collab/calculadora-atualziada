# Insights e Alertas — cobertura total dos orçamentos e remoção das tags coloridas

## O problema confirmado

Ao ler a geração dos insights (`useDashboardComercial.ts`) e o agrupamento (`insightsPorCliente.ts`), há três filtros que escondem orçamentos:

1. Só viram insight de cliente: pedidos aguardando produção, orçamentos em **rascunho com mais de 5 dias** e orçamentos **enviados**. Rascunhos recentes, **pagos** e **recusados** nunca entram.
2. O agrupamento por cliente descarta tudo que não seja `alerta` ou `atencao` — então orçamentos enviados com menos de 5 dias (classificados como `oportunidade`) somem da visão por cliente.
3. O período filtra por `created_at`. Um orçamento criado no mês passado e ainda em aberto hoje não aparece, mesmo estando ativo.

Isso explica o caso do Everton: a tela de Orçamentos lista todos os registros do consultor, o Dashboard lista apenas o subconjunto acima.

## O que muda

### 1. Cobertura total na visão "Por cliente"

A visão passa a listar **todos os orçamentos** do período/consultor filtrado, com uma linha por cliente e o detalhe de cada orçamento, independente do status:

```text
Rascunho   -> em aberto
Enviado    -> em aberto (com dias sem retorno)
Pago       -> fechado (informativo)
Recusado   -> fechado (informativo)
```

Além disso, orçamentos **criados antes do período mas ainda em aberto** (rascunho/enviado) entram na visão, marcados como "anterior ao período". Um interruptor "Incluir anteriores ao período" permite desligar.

### 2. Filtro de status ampliado

O seletor de status da visão por cliente passa a ter: Todos · Em aberto · Rascunho · Enviado · Pago · Recusado · Cobrados hoje. As métricas do topo passam a mostrar: Total em aberto · Clientes únicos · Orçamentos no período · Sem retorno há 5+ dias.

### 3. Remoção das tags de cor

- Sai o badge de prioridade colorido (🔴 Crítico / 🟠 Urgente / 🟡 Atenção / ⚪ Normal); no lugar fica texto simples e neutro ("Crítico", "Urgente", ...), mantendo a mesma ordenação por prioridade.
- Saem os contadores com bolinhas (🔴 x · 🟡 y) do cabeçalho do vendedor, virando texto ("x alertas · y atenções").
- Na visão "Por orçamento", os cartões deixam de usar fundo/borda vermelho e amarelo; passam a usar a borda padrão do tema, mantendo os ícones para diferenciar o tipo.

### 4. Validação dos dados puxados

Cada linha de orçamento na visão por cliente mostra: número, status, valor total, data de criação, data de envio, dias parados e observação interna quando houver — os mesmos campos da tela de Orçamentos, para conferência direta.

## Detalhes técnicos

- `useDashboardComercial.ts`: expor uma nova lista `orcamentosDetalhados` (todos os orçamentos filtrados por consultor/período + os em aberto anteriores ao período), com campos normalizados: `cliente`, `consultor`, `status`, `valor`, `created_at`, `data_envio`, `dias_parado`, `situacao`, `numero_orcamento`, `orcamento_id`, `foraDoPeriodo`. A lista atual de `insights` continua igual, para não alterar a visão "Por orçamento".
- `src/types/dashboard.ts`: novo tipo `OrcamentoDetalhado`; `OrcamentoEmAberto` ganha `status` e `foraDoPeriodo`; `ClienteEmAberto` ganha contagens por status.
- `src/lib/insightsPorCliente.ts`: `agruparInsightsPorCliente` passa a receber `OrcamentoDetalhado[]` (além dos insights de pedido em produção) e deixa de descartar itens que não sejam alerta/atenção. `PRIORIDADE_LABEL` perde os emojis.
- `src/components/dashboard/InsightsPorCliente.tsx`: novos filtros/métricas, colunas extras na linha de orçamento, badges neutros.
- `src/components/dashboard/DashboardInsights.tsx`: remover as classes `bg-red-*` / `bg-yellow-*` / `border-red-*` / `border-yellow-*` dos cartões, passa a receber a nova lista.
- `src/pages/DashboardComercial.tsx`: repassar `orcamentosDetalhados` ao componente.
- Sem alterações no banco de dados.
