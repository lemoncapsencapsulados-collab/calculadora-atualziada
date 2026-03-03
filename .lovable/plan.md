

# Botão "VER DETALHES" com Popup Completo em Pedidos Gerados

## Resumo
Adicionar um botão "VER DETALHES" em cada card de pedido que abre um Dialog com todas as informações completas: dados do cliente, fórmulas/produtos com quantidades e valores, sistema de envio, condições de pagamento e plano/serviços contratados.

## Alterações

### 1. Criar componente `DetalhesPedidoDialog.tsx`
Novo componente Dialog que recebe o pedido e exibe todas as informações organizadas em seções:

- **Informações Gerais**: número do pedido, data, status, consultor, tipo (Novo Produtor/Recompra)
- **Dados do Cliente**: nome completo, email, telefone, CNPJ, razão social, cidade/estado, forma de venda
- **Produtos/Fórmulas**: tabela com nome, quantidade, modelo de negócio, preço unitário, subtotal — ou dados da fórmula (itens, embalagens, custos) para pedidos antigos
- **Serviços de Marca**: nome do plano, descrição, valor
- **Condições de Pagamento**: valor de entrada, forma de pagamento entrada, valor no término, forma de pagamento término, data de pagamento
- **Logística/Frete**: tipo de envio, descrição parcial, frete Lemon Caps, detalhes adicionais
- **Totais**: subtotal produção, subtotal serviços, valor total

O Dialog será scrollável (`max-h-[80vh] overflow-y-auto`) com seções bem separadas usando `Separator`.

### 2. Atualizar `src/pages/Pedidos.tsx`
- Importar `DetalhesPedidoDialog`
- Adicionar state `pedidoDetalhe` para controlar qual pedido está aberto
- Adicionar botão "VER DETALHES" na área de ações de cada card (ao lado de "Baixar Ordem" e do botão de excluir)
- Renderizar o Dialog condicionalmente

## Arquivos
- `src/components/DetalhesPedidoDialog.tsx` — **novo**
- `src/pages/Pedidos.tsx` — adicionar botão e integrar dialog

