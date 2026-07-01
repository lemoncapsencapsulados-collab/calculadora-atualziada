## Objetivo
Adicionar, na tela **Análise Apurada do Vendedor**, um botão extra abaixo da lista de vendedores chamado **"Time de Vendas — Análise Geral"**, que soma os dados de todos os consultores ativos e apresenta a mesma visão da análise individual, mas consolidada.

## Mudanças

### 1. `src/lib/analiseVendedor.ts`
- Adicionar função `carregarAnaliseTimeVendas(mes: Date, vendedores: string[])` que:
  - Chama `carregarAnaliseVendedor` para cada vendedor em paralelo (`Promise.all`).
  - Retorna um `AnaliseVendedor` agregado com `vendedor = "Time de Vendas"`, somando:
    - `qtdVendas`, `qtdOrcamentos`, `receitaTotal`, `valorEmNegociacao`, `totalPotes`, `monetizzeTotalReceber`, `monetizzeComissaoBruta`, `braipTotalReceber`, `braipComissaoBruta`.
    - `potesPorTipo` (merge somando por tipo).
    - `produtosVendidos` (merge por nome, somando `qtdPotes`, `receita`, `vezes`).
    - `setupsVendidos` (merge por nome, somando `quantidade`, `valorTotal`).
    - `vendasPorSetup` (concat arrays por setup).
    - `monetizzeConsultas` e `braipConsultas` (concat).
    - `avisosServicosMarca` (concat).
  - Recalcula derivados:
    - `ticketMedio = receitaTotal / qtdVendas`.
    - `taxaConversao = qtdVendas / qtdOrcamentos`.
    - `maiorVolumePotesVenda = max(...)`.
    - `setupMaisVendido`, `valorMedioSetup`, `maiorValorSetup` a partir dos setups agregados.

### 2. `src/components/dashboard/AnaliseVendedorDialog.tsx`
- Na tela de seleção de vendedor (grid de botões), abaixo do grid, adicionar um botão em largura total: **"Time de Vendas — Análise Geral do Mês"** com ícone `Users`.
- Ao clicar, definir `vendedor = "__TIME__"` (constante sentinela).
- Ajustar `recalcular` / `useEffect` de carregamento: quando `vendedor === "__TIME__"`, chamar `carregarAnaliseTimeVendas(mesData, consultores.map(c => c.nome))` em vez de `carregarAnaliseVendedor`.
- Título do dialog: exibir "Análise Apurada — Time de Vendas" quando for o modo agregado.
- Realtime: manter as subscriptions ativas mas sem filtro por `consultor_nome` no modo time (assinar `event: '*'` na tabela inteira) para atualizar somas ao salvar consultas.
- Exportações PDF/CSV: funcionam sem alteração pois consomem o mesmo formato `AnaliseVendedor`.

## Fora do escopo
- Não altera cálculos individuais nem tabelas do banco.
- Não altera outros dashboards (`RelatorioComissoes`, `DashboardComissoesExternas`).
