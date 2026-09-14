-- Numero de contrato do orcamento: ano e mes da criacao (YYMM), ex.: "2609".
--
-- Nao identifica o pedido, agrupa por periodo -- fica acima do numero do
-- Pedido de Compra na hierarquia. O numero que o financeiro informa continua
-- sendo outro campo, em `pedidos.numero_contrato`.
--
-- Nulo nos orcamentos antigos de proposito: a regra vale daqui pra frente e
-- renumerar historico faria documentos ja' emitidos divergirem do sistema.
alter table public.orcamentos
  add column if not exists numero_contrato text;

comment on column public.orcamentos.numero_contrato is
  'Ano e mes da criacao no formato YYMM. Atribuido quando o orcamento e pago.';
