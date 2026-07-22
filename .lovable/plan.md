## Objetivo

Na tela "Nova Cotação de Frete" (POD) em `src/pages/Logistica.tsx`, permitir editar dinamicamente o **Preço/Envio** de cada plano e ver, em tempo real, a **margem de lucro resultante** — tudo protegido pela senha admin `0212`.

## Comportamento

Para cada linha de plano (na tabela por produto):

1. Coluna **Preço/Envio** vira editável (input numérico) — bloqueada por padrão com ícone de cadeado.
2. Ao clicar em "Editar preço" (ou no cadeado), abre o `AdminPasswordDialog` existente (senha `0212`). Uma vez liberado, todas as linhas daquele produto ficam editáveis na sessão atual (mesmo padrão do "Editar margem" atual).
3. Nova coluna **Margem resultante** exibe:
   - `%` de margem sobre o preço final digitado
   - `R$` de margem em valor absoluto
   - Cor: verde se ≥ margem-alvo da faixa, amarelo se positiva porém abaixo, vermelho se negativa.
4. Fórmula (invertendo a atual `(frete + manuseio + margem) × 1,12`):
   ```
   preco_liquido = preco_editado / (1 + imposto%)
   margem_valor  = preco_liquido − frete_medio − taxa_manuseio
   margem_%      = margem_valor / preco_liquido × 100
   ```
5. Botão "Restaurar calculado" por linha volta o preço ao valor original derivado da margem da faixa.
6. Ao salvar a cotação, o `preco_final` de cada plano em `pod_planos_selecionados` passa a ser o valor editado, e `margem_percentual` de cada item reflete a margem recalculada (com flag `margem_override: true` quando o preço foi editado manualmente).

## Detalhes técnicos

- Arquivo principal: `src/pages/Logistica.tsx` (tabela de planos no diálogo Nova/Editar cotação e no popup "Ver produtos" quando em modo edição).
- Reutilizar `AdminPasswordDialog` de `src/components/admin/AdminPasswordDialog.tsx` — já usa a senha `0212`.
- Estado local por produto: `precoEditadoPorPlano: Record<produtoId, Record<plano, number>>` e `precoUnlockedProdutos: Set<produtoId>`.
- Helper novo em `src/lib/freteHelpers.ts`: `calcularMargemPorPreco({ precoFinal, freteMedio, taxaManuseio, imposto })` retornando `{ margemValor, margemPercentual, precoLiquido }`.
- `pod_planos_selecionados` (JSONB em `frete_cotacoes`) já tem `preco_final`, `margem_percentual` e `margem_override` — sem migração de schema.
- Exportação PNG (`CotacaoExportCard`) e PDF (`blocoPdfFrete`) já leem `preco_final` do JSONB, então herdam o novo valor sem mudança.
- Nada muda fora de Logística (edição de margem existente continua funcionando em paralelo — o override de preço tem prioridade quando presente).
