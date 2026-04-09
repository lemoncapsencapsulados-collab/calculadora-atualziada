

## Plano: Incluir composição do produto POD no PDF e Resumo para Contrato

### Problema
Quando um produto é marcado como Print On Demand (POD), o PDF e o Resumo para Contrato omitem a composição da fórmula (`insumos_formula`), quantidade por frasco, e dose diária. Isso acontece porque o código trata POD como um caso simplificado que só mostra custo unitário.

### Correção

**Arquivo: `src/lib/orcamentoGenerator.ts`** — função `renderProdutos` (linhas 385-397)

Alterar o bloco `if (isPOD)` para que, em vez de pular toda a informação do produto, ele renderize:
- Quantidade por frasco e unidade (se existirem)
- Dose diária sugerida (se existir)
- Composição da fórmula completa (lista de insumos com sanitização de "Amido de Milho" → "Excipiente")
- Detalhes de produção (cores, sabores, etc.)
- Custo unitário (mantém o que já existe)

A única diferença para o modelo estoque será: quantidade de frascos e subtotal não são exibidos (já que POD não tem lote fixo). O label "PRINT ON DEMAND" no cabeçalho do produto será mantido.

### Resultado esperado
Tanto o "Gerar PDF" quanto o "Resumo para Contrato" passarão a mostrar a composição completa do produto POD, pois ambos usam a mesma função `renderProdutos` do `orcamentoGenerator.ts`.

### Arquivo modificado
- `src/lib/orcamentoGenerator.ts`

