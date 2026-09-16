-- Pedido de Compra elaborado a partir do orcamento, antes de existir pedido.
--
-- O consultor preenche o documento na tela do Projeto para Contrato, quando o
-- orcamento ainda nao foi pago e portanto nao ha' linha em `pedidos` onde
-- guardar. Sem esta coluna, tudo que ele preenchia se perdia ao fechar o popup.
alter table public.orcamentos
  add column if not exists pedido_compra_dados jsonb;

comment on column public.orcamentos.pedido_compra_dados is
  'Campos preenchidos do Pedido de Compra v3. Copiados para o pedido quando o orcamento e aprovado.';
