

# Orçamento Aprovado → Proposta Completa no Popup + Auto-criar Pedido

## Resumo
Quando um orçamento for movido para "Aprovado", o popup atual (que só pede data de pagamento) será substituído pelo formulário completo da "Proposta Completa" (dados do cliente, forma de venda, frete, condições de pagamento + data de pagamento). Ao confirmar a aprovação, o sistema automaticamente cria um pedido em "Pedidos Gerados" com todos os dados do orçamento e da proposta comercial.

## Alterações

### 1. Migração SQL — expandir tabela `pedidos`
Adicionar coluna `orcamento_id` (uuid, nullable) e `orcamento_snapshot` (jsonb, nullable) na tabela `pedidos` para armazenar referência e snapshot completo do orçamento aprovado (incluindo dados_cliente, frete, condições de pagamento, itens de produção, serviços).

```sql
ALTER TABLE public.pedidos ADD COLUMN orcamento_id uuid;
ALTER TABLE public.pedidos ADD COLUMN orcamento_snapshot jsonb;
-- Tornar formula_id e formula_snapshot opcionais para pedidos vindos de orçamentos
ALTER TABLE public.pedidos ALTER COLUMN formula_id DROP NOT NULL;
ALTER TABLE public.pedidos ALTER COLUMN formula_snapshot DROP NOT NULL;
```

### 2. Tipos — `src/types/formula.ts`
Atualizar interface `Pedido` para incluir `orcamento_id?: string` e `orcamento_snapshot?: any` (contendo todos os dados do orçamento: itens_producao, servicos_marca, dados_cliente, detalhamento_frete, condicoes_pagamento, consultor, tipo_orcamento, etc).

### 3. Popup de Aprovação — `src/pages/Orcamentos.tsx`
Substituir o dialog simples de "Data de Pagamento" por um dialog maior que embute o formulário da Proposta Completa:
- Reutilizar os campos do `PropostaCompletaDialog` (dados cliente, forma de venda, frete, condições de pagamento)
- Adicionar campo de "Data de Pagamento" ao final
- Ao confirmar: salvar dados_cliente + frete + condições de pagamento no orçamento, alterar status para "aprovado", e auto-criar um pedido na tabela `pedidos` com snapshot completo do orçamento

### 4. Hook `usePedidos` — `src/hooks/usePedidos.ts`
- Adicionar mutation `createPedidoFromOrcamento` que recebe um orçamento aprovado e cria o pedido com:
  - `orcamento_id`: ID do orçamento
  - `orcamento_snapshot`: snapshot completo (itens, cliente, frete, pagamento)
  - `numero_pedido`: gerado automaticamente (PED-001, PED-002...)
  - `data_pedido`: data atual
  - `data_entrega`: pode ser data de pagamento + prazo ou data atual
  - `status`: 'aguardando_producao'

### 5. Página Pedidos — `src/pages/Pedidos.tsx`
- Adaptar os cards para exibir pedidos vindos de orçamentos:
  - Se tem `orcamento_snapshot`: mostrar nome do cliente, consultor, itens de produção, serviços de marca, dados do cliente, condições de pagamento, tipo de orçamento (Novo Produtor/Recompra), modelo (Estoque/POD)
  - Se tem `formula_snapshot` (pedidos antigos): manter exibição atual
- Expandir card com seções: Produtos, Dados do Cliente, Condições de Pagamento, Frete

## Arquivos Modificados
- Migração SQL (novas colunas em `pedidos`)
- `src/types/formula.ts` — atualizar interface Pedido
- `src/pages/Orcamentos.tsx` — substituir popup de aprovação
- `src/hooks/usePedidos.ts` — novo mutation para criar pedido de orçamento
- `src/pages/Pedidos.tsx` — adaptar exibição para pedidos de orçamento

