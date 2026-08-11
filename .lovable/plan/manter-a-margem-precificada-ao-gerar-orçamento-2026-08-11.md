# Manter a margem precificada ao gerar orçamento

## Problema confirmado
A tela de precificação e o passo 2 do orçamento usam alíquotas de imposto diferentes sobre o mesmo produto:

- Precificação (`src/lib/precificacaoCalculator.ts`): imposto fixo de **12%** sobre o preço de venda. Margem = 1 − custo/preço − 12%.
- Orçamento (`src/components/GerarOrcamentoDialog.tsx`, `calcMargemItem`): imposto fixo de **16%**. Margem = 1 − custo/preço − 16%.

Com custo R$ 7,20 e preço R$ 10,80: 21,4% na precificação e 17,3% no orçamento — exatamente os 4 pontos de diferença das alíquotas. Os custos usados são os mesmos (`total_custos_producao` da precificação salva), então o único desvio é a alíquota.

## Correção
Unificar o cálculo de margem em uma única fonte:

1. Expor a alíquota de imposto (12%) e uma função de margem em `src/lib/precificacaoCalculator.ts`, por exemplo `ALIQUOTA_IMPOSTO` exportada e `calcularMargemLiquida(preco, custo)`.
2. Trocar o `calcMargemItem` local do `GerarOrcamentoDialog` por essa função compartilhada, removendo o `0.16` fixo.

Resultado: ao selecionar uma precificação salva, o orçamento mostra exatamente a margem salva (21,4% no exemplo), e ela só muda quando o consultor edita o preço unitário — recalculada com a mesma fórmula.

## Verificação
- Precificar um produto com custo R$ 7,20 / preço R$ 10,80, salvar e gerar orçamento: a margem exibida deve ser 21,4% nas duas telas.
- Alterar o preço unitário no orçamento: a margem recalcula pela mesma fórmula, e a validação de margem mínima (senha) continua funcionando.
