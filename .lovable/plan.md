

# Separar gráfico de distribuição + Melhorar insights de orçamentos

## Alterações

### 1. Separar tabela e gráfico (`src/components/dashboard/DashboardOrcamentos.tsx`)
- Dividir o componente em dois: a tabela "Orçamentos por Vendedor" fica como está, e o gráfico "Distribuição de Orçamentos" vira um componente separado (ou exportar ambos separadamente)
- Exportar `DashboardOrcamentosDistribuicao` como componente adicional com apenas o gráfico de barras

### 2. Reordenar seções (`src/pages/DashboardComercial.tsx`)
Nova ordem:
1. KPIs
2. Vendas e Ranking
3. Pipeline
4. Gráficos
5. Recorrência (Recompras)
6. **Orçamentos por Vendedor** (tabela)
7. **Distribuição de Orçamentos** (gráfico)
8. Insights e Alertas

### 3. Melhorar insights de orçamentos (`src/hooks/useDashboardComercial.ts`)
Adicionar mais alertas relacionados a tempo de orçamentos enviados:
- Orçamentos enviados há **3-7 dias** sem atualização: tipo `atencao` (lembrete de follow-up)
- Orçamentos enviados há **mais de 14 dias**: tipo `alerta` com urgência maior
- Orçamento com **valor alto** (acima de R$5.000) enviado sem retorno: alerta específico
- Resumo: total de orçamentos enviados aguardando retorno e valor acumulado
- Por consultor: listar quem tem mais orçamentos enviados parados

## Arquivos modificados
| Arquivo | Mudança |
|---|---|
| `src/components/dashboard/DashboardOrcamentos.tsx` | Separar em dois componentes exportados |
| `src/pages/DashboardComercial.tsx` | Reordenar seções, importar novo componente |
| `src/hooks/useDashboardComercial.ts` | Adicionar insights granulares sobre tempo de orçamentos enviados |

