

# Print On Demand - Modelo de Orcamento no Passo 2

## Contexto
Atualmente, ao adicionar uma precificacao salva no Passo 2, o sistema assume modelo de Estoque (quantidade de produtos). O usuario precisa diferenciar entre dois modelos de negocio:

- **Estoque**: modelo atual, calcula quantidade de produtos, custo por volume
- **Print On Demand (POD)**: sem compra de estoque, lucro apenas quando o produtor vende. Exibe apenas produto + custo unitario

## Alteracoes

### 1. Tipos - `src/types/orcamento.ts`
- Adicionar campo `modelo_negocio?: 'estoque' | 'print_on_demand'` na interface `ItemProducao`
- Quando nao preenchido, assume `'estoque'` (retrocompatibilidade)

### 2. Componente - `src/components/GerarOrcamentoDialog.tsx`

**Ao adicionar precificacao salva:**
- Apos o item ser adicionado na lista, exibir um seletor de modelo (Radio Group ou Select) no card do item: "Estoque" ou "Print On Demand"
- Default: `'estoque'`
- Quando `print_on_demand` selecionado:
  - Ocultar campo de quantidade (fixar em 1 ou remover)
  - Exibir badge "Print On Demand" no card
  - Subtotal = preco unitario (sem multiplicar por quantidade)

**Na lista de itens (linhas ~532-610):**
- Ao lado do badge "Salvo"/"Avulso", exibir badge "POD" em cor diferenciada se `modelo_negocio === 'print_on_demand'`
- Quando POD: ocultar input de quantidade, mostrar apenas custo unitario
- Quando POD: ocultar campos de "Qtd por Pote" e "Dose diaria" (nao aplicaveis)

### 3. PDF Orcamento - `src/lib/orcamentoGenerator.ts`

Na funcao `renderProdutos` (linhas ~255-350):
- Se `item.modelo_negocio === 'print_on_demand'`:
  - Adicionar badge/texto "PRINT ON DEMAND" ao lado do nome do produto no header do item
  - Exibir "Custo Unitario: R$ X,XX" ao inves de "Quantidade X un. / Preco Unit. / Subtotal"
  - Nao exibir composicao da formula (insumos)
  - Nao exibir quantidade por pote nem dose diaria

### 4. PDF Proposta Completa - `src/lib/propostaGenerator.ts`
- Verificar se a proposta completa referencia `itens_producao` (atualmente usa `PropostaData` separado, entao pode nao precisar de alteracao imediata - apenas se o fluxo de proposta completa consumir itens de orcamento)

## Arquivos Modificados
- `src/types/orcamento.ts` - novo campo `modelo_negocio`
- `src/components/GerarOrcamentoDialog.tsx` - seletor de modelo + ajuste visual do card
- `src/lib/orcamentoGenerator.ts` - renderizacao diferenciada no PDF

