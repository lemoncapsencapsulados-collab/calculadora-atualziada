-- Histórico de edições de orçamentos e pedidos.
--
-- Os dois documentos passaram a se atualizar sozinhos: quando um produto
-- precificado muda, e quando o Orçamento para Contrato é gravado. Isso resolve
-- o preço e a fórmula desatualizados, mas cria uma pergunta nova -- "por que
-- este valor está diferente do que mandei ao cliente?" -- que aparece no pior
-- momento, com o cliente na linha.
--
-- Cada entrada guarda a data com hora e minuto, de onde veio a mudança, e o
-- que mudou em texto corrido. Texto, e não um diff de campos: quem lê é o
-- consultor, e "Dose diária: 2 cápsulas ao dia → 3 cápsulas ao dia" responde
-- sem precisar de tradução.
--
--   {"em": "2026-10-23T14:07:00Z",
--    "origem": "orcamento_para_contrato",
--    "mudancas": ["Multi — dose diária: \"2 cápsulas ao dia\" → \"3 cápsulas ao dia\""]}
--
-- jsonb e não tabela própria: é um log curto, sempre lido junto do documento e
-- nunca consultado por conta própria -- os outros históricos deste banco
-- (`pagamento_alteracoes`, `historico_vhsys`, `historico_contatos`) seguem o
-- mesmo caminho.
--
-- Substitui a migração 20261015120000_historico_preco, que nunca chegou a ser
-- aplicada: o mesmo log serve às duas origens, e duas colunas para a mesma
-- pergunta só fariam metade da resposta aparecer em cada tela.
alter table public.orcamentos
  add column if not exists historico_edicoes jsonb not null default '[]'::jsonb;

alter table public.pedidos
  add column if not exists historico_edicoes jsonb not null default '[]'::jsonb;

comment on column public.orcamentos.historico_edicoes is
  'Edições do orçamento e do Pedido de Compra dele. Cada item: {em, origem, mudancas[]}.';

comment on column public.pedidos.historico_edicoes is
  'Mesmo formato de orcamentos.historico_edicoes.';
