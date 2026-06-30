## Diagnóstico

O painel "Custo de Matéria-Prima" mostra `R$ 0,00` em todas as linhas (e no Total MP) da fórmula DRENAGEM LINFÁTICA porque o custo de cada insumo, depois de calculado, é **formatado com `formatCurrency()`** que arredonda em cascata para **2 casas decimais**. Para quantidades minúsculas (ex.: `L-Carnitina 0,217 mg` num insumo cotado por kg/g), o custo real é da ordem de `1e-5` a `1e-7` reais por linha — qualquer coisa abaixo de `R$ 0,005` vira `R$ 0,00`.

O cálculo interno em si (`calcularCustoInsumo` em `src/lib/unitConversion.ts`) já trabalha em ponto-flutuante e converte `mg/mcg → kg/g` corretamente. O `custo_calculado` salvo no JSONB de `formulas.itens` também é o número bruto (sem arredondamento). O que está "errado" é exclusivamente o **arredondamento na exibição** das linhas e do Total MP. Os totais ficam `R$ 0,00` porque os componentes já mostrados estão zerados, e a soma de 10 valores muito pequenos continua sub-centavo.

Bônus encontrado: em `src/pages/Calculator.tsx` (linha 401-408), o `totalMP` para o tipo **Líquido** trata `qtdCapsulas` como número de doses. Se o usuário lança "30 mL" e `unidadesPorDose = 1`, o cálculo dá `numDoses = 30` (ok). Mas se a fórmula antiga foi salva com `unidadesPorDose` default, esse total pode estar subdimensionado. Vou validar e corrigir junto.

## O que vou fazer

### 1. Novo formatter de precisão estendida (`src/lib/unitConversion.ts`)
Criar `formatCurrencyPrecise(valor, minDecimals = 2, maxDecimals = 20)`:
- Se `|valor| >= 0,01` → comporta-se como `formatCurrency` (R$ x,xx).
- Se `0 < |valor| < 0,01` → exibe com casas decimais suficientes (até 20) para mostrar o **primeiro dígito significativo + mais 2** (ex.: `R$ 0,0000217` em vez de `R$ 0,00`).
- Zero exato continua `R$ 0,00`.
- Implementação sem arredondamento intermediário, usando `Number.toFixed(20)` e cortando zeros à direita.

### 2. Aplicar `formatCurrencyPrecise` nos pontos onde aparece o "R$ 0,00"
- `src/components/PrecificacoesSalvas.tsx` (linhas 467-478): custos por matéria-prima e Total MP da fórmula.
- `src/components/VerFormulaDialog.tsx`: mesma exibição de itens da fórmula.
- `src/pages/Calculator.tsx` (linha 1304 e linha 1344): "Custo por dose" e "Total MP" no resumo.
- `src/lib/pdfGenerator.ts`: linhas de custo unitário de matéria-prima no PDF (mantendo o total final em 2 casas, mas mostrando o custo por item com precisão estendida quando for sub-centavo).

### 3. Garantir que a soma usa valores brutos (sem perdas)
- Auditar `Calculator.tsx` (linhas 397-408): `custoUnitarioMP` e `totalMP` já somam `item.custo` cru — manter assim, sem aplicar `arredondarReais` no meio.
- Em `handleSave` (linha 525-541), `custo_calculado` continua sendo o `item.custo` bruto (ponto flutuante completo, sem `arredondarReais`).
- A `formulas.itens` é JSONB, então não há truncamento de schema na gravação.

### 4. Corrigir multiplicador de Líquido (defesa)
Em `Calculator.tsx` linha 401-408: para `tipoProduto === 'Líquido'`, garantir que `qtdTotal` use o volume do pote em mL (`qtdCapsulas`) e `unidadesDose` use mL por dose. Se `unidadesPorDose` vier vazio/zero, usar `1` (mL) como dose padrão para que `numDoses` reflita o volume completo do pote. Apenas defesa — não muda fórmulas onde o usuário já preencheu corretamente.

### 5. Não alterar o cálculo nem regravar fórmulas existentes
Os valores salvos no banco continuam corretos (em float bruto). Apenas a renderização passa a expor a precisão real. Nada de migração de dados.

## Resultado esperado

Para a DRENAGEM LINFÁTICA do print, cada linha de matéria-prima passará a exibir, por exemplo, `R$ 0,0000217` em vez de `R$ 0,00`, e o **Total MP** mostrará a soma com casas decimais suficientes para refletir o valor real (ainda muito pequeno por se tratar de doses em mg/mcg em 30 mL — mas agora visível e auditável). Se a soma alcançar `≥ R$ 0,01`, volta automaticamente ao formato padrão `R$ x,xx`.
