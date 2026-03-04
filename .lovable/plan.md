

# Plano: Validação obrigatória completa + Edição de Pedidos + Fórmulas detalhadas

## 3 Entregas

### 1. Tornar TODOS os campos de produto obrigatórios na Aprovação
Atualmente, produtos sem segmento reconhecido (Encapsulado/Gummy/Solúvel) passam sem validação. Corrigir para que **todos** os itens exijam seus campos condicionais preenchidos — e para produtos com segmento não reconhecido (ex: Líquido), também exigir alguma confirmação ou tratá-los explicitamente.

**Arquivo:** `src/components/AprovacaoOrcamentoDialog.tsx`
- Na validação de `handleConfirmAprovacao`, garantir que itens com segmentos "Líquido" ou outros também sejam tratados (atualmente o `if/else if` ignora segmentos não mapeados)
- Adicionar validação para segmento "Líquido" — se necessário, sem campos extras mas com confirmação implícita

### 2. Campo de Edição (observações editáveis) em cada Pedido Gerado
Adicionar um botão "Editar" em cada card de pedido que permite editar as observações/notas do pedido para a equipe de produção ver alterações.

**Arquivos:**
- `src/hooks/usePedidos.ts` — adicionar mutation `updateObservacoes` para atualizar o campo `observacoes` do pedido
- `src/pages/Pedidos.tsx` — adicionar um botão "Editar Observações" que abre um campo Textarea inline ou um Dialog simples para editar as observações do pedido. Ao salvar, chama a mutation

### 3. Puxar fórmulas completas com insumos na seção Produtos de "Ver Detalhes"
O campo `insumos_formula` já existe no `ItemProducao` e é preenchido no momento da geração do orçamento (em `GerarOrcamentoDialog`). Preciso exibi-lo no `DetalhesPedidoDialog`.

**Arquivo:** `src/components/DetalhesPedidoDialog.tsx`
- Na seção de Produtos, para cada item, se `item.insumos_formula` existir e tiver itens, renderizar uma sub-tabela/lista com:
  - Nome do insumo
  - Quantidade
  - Unidade
- Mostrar também `dose_diaria_sugerida`, `quantidade_por_pote`, `unidade_por_pote` quando disponíveis

## Arquivos modificados
- `src/components/AprovacaoOrcamentoDialog.tsx` — validação completa
- `src/hooks/usePedidos.ts` — nova mutation de update observações
- `src/pages/Pedidos.tsx` — botão/dialog de edição de observações
- `src/components/DetalhesPedidoDialog.tsx` — exibir insumos da fórmula por produto

