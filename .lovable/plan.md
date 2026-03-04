

# Plano: Cor Transparente em Encapsulados + Novo Fluxo de Condições de Pagamento

## 1. Encapsulados — Trocar "Branca/Branco" por "Transparente"
**Arquivo:** `src/components/AprovacaoOrcamentoDialog.tsx`
- Cor da Tampa: Preta / Transparente (em vez de Branca)
- Cor do Pote: Preto / Transparente (em vez de Branco)

## 2. Novo fluxo de Condições de Pagamento

Substituir completamente o `CondicoesPagamentoForm` com a seguinte lógica:

### Pergunta inicial: "Método de Pagamento"
4 opções: **À vista** | **Cartão de Crédito** | **Fracionado** | **2 Cartões diferentes**

### Se "À vista"
- Sub-opção: Pix, Transferência, Débito ou Boleto
- Valor = valor total do orçamento

### Se "Cartão de Crédito"
- Parcelas de 1x a 6x
- Tabela de juros automática sobre o valor total:
  - 1x a 3x: sem juros
  - 4x: +7%
  - 5x: +8%
  - 6x: +9%
- Exibe: valor de cada parcela, valor total corrigido

### Se "Fracionado" (parte à vista + parte no cartão)
- Input: valor à vista → sub-opção (Pix/Transferência/Débito/Boleto)
- Valor restante automaticamente vai para o cartão → parcelas 1-6x com mesma tabela de juros
- Exibe resumo com valor à vista + valor parcelado (corrigido) = total final

### Se "2 Cartões diferentes"
- Input: valor no Cartão 1 → parcelas 1-6x com juros
- Valor restante automaticamente no Cartão 2 → parcelas 1-6x com juros
- Exibe resumo com parcelas de cada cartão + total final corrigido

## Alterações no tipo `CondicoesPagamento`
**Arquivo:** `src/types/orcamento.ts`

Atualizar a interface para suportar o novo modelo:
```typescript
export type MetodoPagamentoPrincipal = 'avista' | 'cartao_credito' | 'fracionado' | 'dois_cartoes';
export type FormaPagamentoAvista = 'pix' | 'transferencia' | 'debito' | 'boleto';

export interface CondicoesPagamento {
  metodo_principal?: MetodoPagamentoPrincipal;
  // À vista
  forma_avista?: FormaPagamentoAvista;
  // Cartão de crédito
  parcelas_cartao?: number;
  // Fracionado
  valor_avista?: number;
  forma_avista_fracionado?: FormaPagamentoAvista;
  parcelas_cartao_fracionado?: number;
  // 2 Cartões
  valor_cartao1?: number;
  parcelas_cartao1?: number;
  parcelas_cartao2?: number;
  // Campos legados (manter compatibilidade)
  valor_entrada?: number;
  forma_pagamento_entrada?: FormaPagamentoTipo;
  descricao_entrada?: string;
  valor_termino?: number;
  usa_valor_restante?: boolean;
  forma_pagamento_termino?: FormaPagamentoTipo;
  descricao_termino?: string;
}
```

## Arquivos modificados
- `src/types/orcamento.ts` — novos tipos de pagamento
- `src/components/CondicoesPagamentoForm.tsx` — reescrita completa do formulário
- `src/components/AprovacaoOrcamentoDialog.tsx` — trocar Branca→Transparente nos Encapsulados

