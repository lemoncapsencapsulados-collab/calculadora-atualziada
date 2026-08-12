# Mover "Funil de Anúncios" para o final do Dashboard

## O que muda
O bloco "Funil de Anúncios — Captação até Conversão", hoje exibido logo no topo (abaixo dos KPIs e das Comissões Externas), passa a ser a última seção da página do Dashboard Comercial.

## Nova ordem da página
1. Cabeçalho + filtros
2. KPIs
3. Comissões Externas
4. Vendas e Ranking
5. Alterações de Pagamento
6. Orçamentos por Vendedor
7. Distribuição de Orçamentos
8. Insights
9. Funil de Anúncios — Captação até Conversão

## Detalhe técnico
Em `src/pages/DashboardComercial.tsx`, mover o bloco `<DashboardFunilAnuncios ... />` para depois de `<DashboardInsights />`, mantendo as mesmas props (filtros, ranking de consultores e orçamentos por consultor/status). Nenhuma lógica de cálculo é alterada.
