## Objetivo

Na tela **Dashboard → Análise Apurada do Vendedor**, adicionar 3 métricas dentro do card "Funil Completo" de cada vendedor (e também para o Time de Vendas):

1. **ROI da operação** — retorno sobre o investimento em anúncios do vendedor no mês.
2. **Taxa de conversão TOTAL** — Vendas (incluindo Recompras) ÷ Orçamentos.
3. **Taxa de conversão Novo Produtor** — Vendas (excluindo Recompras) ÷ Orçamentos.

## Como identificar Recompra vs Novo Produtor

Recompras já são gravadas como `pedidos` (via `criarRecompraComPedido`) com `orcamento_snapshot.tipo_orcamento` = `'recompra'` ou `'recompra_pod'`. Vendas de "Novo Produtor" = pedidos cujo snapshot NÃO tem esses tipos.

## Fórmulas

- `receitaRecompras` = soma de `valor_total` dos pedidos com `tipo_orcamento` recompra/recompra_pod no mês.
- `receitaNovosProdutores` = `receitaTotal - receitaRecompras`.
- `qtdVendasRecompras` = contagem desses pedidos.
- `qtdVendasNovosProdutores` = `qtdVendas - qtdVendasRecompras`.
- `taxaConversaoTotal` = `qtdVendas / qtdOrcamentos` (já existe como `taxaConversao`, apenas renomear rótulo visual).
- `taxaConversaoNovoProdutor` = `qtdVendasNovosProdutores / qtdOrcamentos`.
- `ROI` = `(receitaTotal - investimento) / investimento` — exibido como % (ex.: `320%`). Quando `investimento = 0`, mostrar `—`.

Observação: orçamentos gerados no fluxo de recompra são criados como pedidos diretos (`orcamento_id: null`), portanto NÃO inflam `qtdOrcamentos` — o denominador continua correto para ambas as taxas.

## Alterações técnicas

**1. `src/lib/analiseVendedor.ts`**
- Estender a interface `AnaliseVendedor` com: `qtdVendasRecompras`, `qtdVendasNovosProdutores`, `receitaRecompras`, `receitaNovosProdutores`, `taxaConversaoNovoProdutor`.
- Em `carregarAnaliseVendedor`, ao iterar `pedidos`, classificar via `snap.tipo_orcamento` e acumular os novos campos.
- Em `carregarAnaliseTimeVendas`, somar os novos campos das partes.
- Em `gerarCSVAnalise`, adicionar linhas de "Taxa de conversão (com recompras)", "Taxa de conversão (novos produtores)", "Receita de recompras", "Vendas de recompras".

**2. `src/components/dashboard/AnaliseVendedorDialog.tsx`**
- No card "Funil Completo", substituir o `MetricCard` atual de conversões pelos 3 novos:
  - `Conv. Total (c/ recompra)` — verde
  - `Conv. Novo Produtor` — azul
  - `ROI` — destaque (com formatação `%` ou `—`)
- Manter Lead→Orç, Orç→Venda, Lead→Venda como estão (esses continuam se referindo ao funil de captação).
- Adicionar ao PDF (`exportarPDF`) as 3 métricas na tabela de resumo.

**3. Sem migrações de banco** — todos os dados necessários já existem.

## Fora de escopo

- Recalcular Funil de Anúncios do Dashboard geral.
- Filtro para alternar entre "com/sem recompra" no restante da análise (potes, produtos, setups). Esses continuam refletindo todos os pedidos.
