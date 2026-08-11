# Dashboard: filtro global e remoção de blocos

## Objetivo
O filtro de período (mensal, intervalo customizado) deve valer para a página inteira, todas as métricas. E remover blocos que hoje ignoram o período.

## Remoções
- "Distribuição de Pedidos por Consultor" (bloco Pipeline)
- "Evolução de Faturamento" e "Distribuição por Canal de Venda" (bloco Gráficos)
- "Vendas Recorrentes (Recompras)"

Os dados de recompras continuam existindo no banco; apenas o bloco sai do Dashboard.

## Correção do filtro
Hoje só os pedidos respeitam o período. Os orçamentos são filtrados apenas por consultor, então KPIs como "Em Orçamento", "Taxa de Conversão", "Recusados", a tabela de Orçamentos por Vendedor, a Distribuição de Orçamentos, o Funil de Anúncios e os Insights mostram números de todo o histórico (é por isso que aparece R$ 2.579.834,78 em orçamento e 85 recusados num filtro de agosto).

Passa a valer:
- Orçamentos filtrados por período usando a data de criação do orçamento, além do consultor.
- Todos os cálculos derivados (KPIs, ranking, pipeline, orçamentos por consultor/status, insights, funil de anúncios) usam essa mesma base filtrada.
- Comissões Externas: hoje usa só o mês da data inicial. Passa a somar todos os meses cobertos pelo intervalo selecionado (e o título mostra o intervalo).
- Alterações de Pagamento e Análise Apurada do Vendedor continuam alinhadas ao mesmo período.

## Detalhes técnicos
- `src/hooks/useDashboardComercial.ts`: aplicar recorte de data em `orcamentosFiltrados` (comparação de string `yyyy-MM-dd` sobre `created_at`, igual ao padrão já usado em `pedidosFiltrados`); remover `evolucaoTemporal`, `distribuicaoCanais` e `distribuicaoConsultorStatus` do retorno.
- `src/pages/DashboardComercial.tsx`: remover render e imports de `DashboardPipeline`, `DashboardGraficos`, `DashboardRecorrencia` e do hook `useRecompras`; manter a lista de consultores só a partir de `consultoresUnicos`.
- Excluir `src/components/dashboard/DashboardPipeline.tsx`, `DashboardGraficos.tsx`, `DashboardRecorrencia.tsx` e limpar tipos órfãos em `src/types/dashboard.ts` (`EvolucaoTemporal`, `DistribuicaoCanal`, `DistribuicaoConsultorStatus`, `MetricasRecorrencia`) que deixem de ser usados.
- `src/components/dashboard/DashboardComissoesExternas.tsx`: iterar os meses do intervalo (`dataInicio`..`dataFim`) e agregar as consultas salvas de Monetizze/Braip.
