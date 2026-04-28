# Prazo de entrega de 30 dias na tela de Pedidos

Adicionar visibilidade do prazo de produção (30 dias corridos a partir da data de pagamento), destacar os dias restantes em cada card, e adicionar filtro por data de entrega.

## O que será implementado

### 1. Cálculo do prazo (30 dias após o pagamento)
- Criar helper `calcularPrazoEntrega(dataPagamento)` em `src/pages/Pedidos.tsx`:
  - `dataPrevistaEntrega = dataPagamento + 30 dias corridos`
  - `diasRestantes = dias entre hoje e dataPrevistaEntrega`
- Fonte da data de pagamento: `pedido.orcamento_snapshot.data_pagamento`. Se não existir, usar `pedido.data_pedido` como fallback.
- Pedidos já concluídos não mostram contagem (mostram "Entregue").

### 2. Destaque visual no topo de cada card de pedido
No `CardHeader` de cada pedido (`src/pages/Pedidos.tsx`, ~linha 562), adicionar uma faixa de destaque logo abaixo do nome do cliente, contendo:
- **Badge grande com os dias restantes** (ex: `⏱ 18 dias restantes`)
- **Data prevista de entrega** (ex: `Entrega prevista: 28/05/2026`)

Cores semânticas do badge:
- Verde: > 10 dias restantes
- Amarelo: entre 1 e 10 dias
- Vermelho: 0 dias ou atrasado (ex: `Atrasado 3 dias`)
- Cinza: pedido já concluído

### 3. Linha de prazo dentro do bloco de detalhes
Em `renderOrcamentoPedido` (perto do bloco de "Pgto:"), adicionar uma linha:
- `📦 Entrega prevista: 28/05/2026 (30 dias após pagamento)`

### 4. Novo filtro por data de entrega
Em `src/pages/Pedidos.tsx`, ao lado dos filtros existentes "Pgto. De / Pgto. Até", adicionar:
- `Entrega De` (date picker)
- `Entrega Até` (date picker)

Lógica de filtro: calcular `dataPrevistaEntrega` de cada pedido (pagamento + 30 dias) e comparar com o intervalo selecionado. Atualizar o botão "Limpar filtros" para resetar também esses dois novos campos.

### 5. (Opcional, mas útil) Ordenação por urgência
Adicionar um botão/select "Ordenar por: Mais urgente" que reordena `filteredPedidos` por `diasRestantes` ascendente. Pedidos concluídos vão para o final.

## Arquivos afetados
- `src/pages/Pedidos.tsx` — único arquivo a alterar.

## Observações
- Prazo fixo de 30 dias corridos, conforme regra de negócio atual. Se no futuro precisar ser configurável por pedido, pode-se adicionar um campo `prazo_dias` no pedido — não está no escopo agora.
- Sem mudanças no banco de dados.
