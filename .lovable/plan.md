

# Plano: Dashboard com orçamentos, insights melhorados, remover botão recompra, botão Gerar PIX

## 1. Dashboard: Adicionar relatório de orçamentos por vendedor

**`src/hooks/useDashboardComercial.ts`**
- Adicionar query para buscar TODOS os orçamentos (tabela `orcamentos`)
- Calcular novos dados:
  - `orcamentosPorStatus`: por consultor, quantos em cada status (rascunho, enviado, pago, recusado) e valor em cada etapa
  - `totalEmOrcamento`: valor total de orçamentos em negociação (rascunho + enviado)
  - Taxa de conversão real: pagos / (pagos + recusados)
- Atualizar KPIs: `pipelineNegociacao` = valor em rascunho+enviado, `taxaConversao` = calculada dos orçamentos, `totalRecusados` = count recusados
- Retornar `orcamentosPorConsultorStatus` nos dados do hook

**`src/types/dashboard.ts`**
- Adicionar type `OrcamentosPorConsultorStatus` com campos `consultor`, `rascunho`, `enviado`, `pago`, `recusado`, `valorRascunho`, `valorEnviado`, `valorPago`, `valorRecusado`, `total`

**`src/components/dashboard/DashboardKPIs.tsx`**
- Adicionar KPI "Em Orçamento" (valor rascunho+enviado) e "Recusados" (count)

**Novo componente: `src/components/dashboard/DashboardOrcamentos.tsx`**
- Card com tabela mostrando por consultor: qtd e valor em cada status de orçamento
- Gráfico de barras empilhadas similar ao Pipeline

## 2. Insights considerando orçamentos

**`src/hooks/useDashboardComercial.ts`** (seção insights)
- Alertas de orçamentos parados em "rascunho" há mais de X dias
- Alerta de orçamentos "enviados" sem retorno há mais de 7 dias
- Consultor com muitos recusados (taxa de recusa alta)
- Oportunidade: valor alto em pipeline de orçamentos

## 3. Remover botão "Nova Recompra" do dashboard

**`src/components/dashboard/DashboardRecorrencia.tsx`**
- Remover o `<Button>` "Nova Recompra" do CardHeader (linha 50-53)
- Remover prop `onNovaRecompra` da interface

**`src/pages/DashboardComercial.tsx`**
- Remover prop `onNovaRecompra` da chamada ao componente
- Remover state `novaRecompraOpen` e o `<NovaRecompraDialog>`
- Limpar imports não usados

## 4. Botão "Gerar PIX" quando status muda para "Enviado"

**`src/pages/Orcamentos.tsx`** (list view, ~linha 308-320)
- Quando `orcamento.status === 'enviado'`, adicionar botão "Gerar PIX" que abre `https://www.asaas.com/c/e8z81rc6owbwhpde` em nova aba

**`src/components/OrcamentoKanbanView.tsx`** (kanban cards, ~linha 117-152)
- Quando `o.status === 'enviado'`, adicionar ícone/botão "Gerar PIX" com mesmo link

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useDashboardComercial.ts` | Query orçamentos, KPIs reais, insights de orçamentos |
| `src/types/dashboard.ts` | Novo type `OrcamentosPorConsultorStatus` |
| `src/components/dashboard/DashboardKPIs.tsx` | KPIs adicionais (em orçamento, recusados) |
| `src/components/dashboard/DashboardOrcamentos.tsx` | Novo componente - relatório orçamentos por vendedor |
| `src/components/dashboard/DashboardRecorrencia.tsx` | Remover botão nova recompra |
| `src/components/dashboard/DashboardInsights.tsx` | Sem mudanças (já renderiza insights dinamicamente) |
| `src/pages/DashboardComercial.tsx` | Integrar DashboardOrcamentos, remover NovaRecompraDialog |
| `src/pages/Orcamentos.tsx` | Botão "Gerar PIX" em orçamentos enviados |
| `src/components/OrcamentoKanbanView.tsx` | Botão "Gerar PIX" no kanban |

