# Comissão do intermediador em porcentagem, por pote

Reescreve o bloco de resultado do Passo 5 (Confirmação do Orçamento + Intermediador) para mostrar o impacto da comissão em **porcentagem de margem por pote**, e remove a margem de Setup da Lemon.

## O que passa a aparecer

**1. Ganho do intermediador no pedido**
- Valor total da comissão em R$ e o percentual aplicado (3% primeira compra / 1% recompra).
- Quanto ele ganha por produto e por pote (comissão rateada / quantidade).

**2. Impacto por produto (uma linha por produto do orçamento)**

```text
Produto            Preço/pote   Margem antes   Comissão/pote   Margem depois   Queda
Whey 60 caps       R$ 10,80     21,4%          R$ 0,32         18,4%           -3,0 p.p.
```

- Margem antes: fórmula atual (preço − custo − 12% imposto), já usada na precificação.
- Comissão por pote: comissão rateada do produto dividida pela quantidade.
- Margem depois: margem antes menos a comissão por pote, em % sobre o preço.
- Queda: diferença em pontos percentuais (é o percentual da comissão sobre o preço do pote).

**3. Resumo**
- Queda média de margem em % no bloco de produção.
- Margem de produção da Lemon depois da comissão, em % (valor em R$ como apoio).

## O que sai

- Todo o bloco "Margem Lemon — Setup" (antes/comissão/depois) — não é mais exibido.
- O bloco "Margem total Lemon após comissão" em R$ deixa de misturar setup; passa a mostrar apenas produção em %.

O rateio da comissão continua proporcional (produção e setup), pois a comissão incide sobre o valor total do orçamento; apenas a parte de setup deixa de ser exibida como margem.

## Detalhes técnicos

- `src/components/GerarOrcamentoDialog.tsx`: passar para o passo um array `itensComCusto` derivado de `itensProducao` + `itemPrecoAux` (`nome`, `preco_unitario`, `quantidade`, `custoUnit`), em vez de apenas `custoProducao` agregado.
- `src/lib/intermediador.ts`: nova função `calcularImpactoPorItem(itens, comissaoTotal, base)` retornando, por item, comissão rateada (proporcional ao subtotal do item sobre a base), comissão por pote, margem % antes/depois e queda em p.p.; reutiliza `calcularMargemLiquida` e `ALIQUOTA_IMPOSTO`. `calcularResumoIntermediador` mantém os campos de setup (usados no cálculo do rateio), só deixam de ser renderizados.
- `src/components/orcamento/ConfirmacaoIntermediadorStep.tsx`: substituir os dois blocos de margem por uma tabela por produto + resumo em %.
- Nenhuma mudança em banco, PDF do cliente, Projeto para Contrato ou Pedidos.
