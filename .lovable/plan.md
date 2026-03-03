

# Seção "Detalhes do Produto" na Aprovação + Exibição em Pedidos Gerados

## Resumo

Adicionar uma seção obrigatória "Detalhes do Produto" no dialog de aprovação de orçamento, entre "Informações do Cliente" e "Forma de Venda". Cada produto listado no orçamento mostrará seus dados (nome, quantidade, segmento) e campos adicionais condicionais ao tipo (`segmento`). Esses detalhes serão salvos no snapshot do orçamento e exibidos no "Ver Detalhes" dos Pedidos Gerados.

## Campos condicionais por tipo de produto

| Segmento | Campos extras |
|---|---|
| **Encapsulados** | Cor da tampa (Preta/Branca), Cor do pote (Preto/Branco) |
| **Gummy** | Cor da Gummy (Vermelho/Roxo/Verde), Sabor (Frutas vermelhas/Morango/Uva/Limão/Maçã verde) |
| **Solúvel** (Pó) | Sabor (Limão/Frutas vermelhas/Morango/Uva), Cor (Verde/Vermelho/Roxo) |

## Alterações

### 1. Tipo `ItemProducao` — `src/types/orcamento.ts`
Adicionar campos opcionais para detalhes de produção:
```typescript
// Detalhes de produção (preenchidos na aprovação)
detalhes_producao?: {
  cor_tampa?: string;
  cor_pote?: string;
  cor_gummy?: string;
  sabor_gummy?: string;
  sabor_soluvel?: string;
  cor_soluvel?: string;
};
```

### 2. `AprovacaoOrcamentoDialog.tsx` — Nova seção "Detalhes do Produto"
- Adicionar state `detalhesProducao` (mapa por índice do item)
- Renderizar seção entre "Informações do Cliente" (seção 1) e "Forma de Venda" (seção 2), renumerando as seções seguintes (2→3, 3→4, 4→5, 5→6)
- Para cada item em `orcamento.itens_producao`, exibir:
  - Nome do produto, quantidade, segmento (read-only)
  - Se `segmento` contém "Encapsulados": selects para cor da tampa e cor do pote
  - Se `segmento` contém "Gummy": selects para cor e sabor
  - Se `segmento` contém "Pó" ou "Solúvel": selects para sabor e cor
- **Validação obrigatória** em `handleConfirmAprovacao`: verificar que todos os campos condicionais de cada item estão preenchidos
- Ao confirmar, mesclar `detalhes_producao` nos `itens_producao` antes de salvar no orçamento e criar o pedido

### 3. `DetalhesPedidoDialog.tsx` — Exibir detalhes de produção
- Na seção de Produtos, para cada item, além de nome/quantidade/modelo/preço, exibir:
  - Dose diária sugerida (campo `dose_diaria_sugerida` do item)
  - Detalhes de produção (cor tampa, cor pote, cor gummy, sabor, etc.) vindos de `item.detalhes_producao`
- Usar badges ou InfoRows para cada campo preenchido

## Arquivos Modificados
- `src/types/orcamento.ts` — adicionar `detalhes_producao` em `ItemProducao`
- `src/components/AprovacaoOrcamentoDialog.tsx` — nova seção + validação + salvar dados
- `src/components/DetalhesPedidoDialog.tsx` — exibir detalhes de produção na tabela de produtos

