-- Histórico de mudanças de preço vindas da edição do produto precificado.
--
-- Editar matéria-prima ou embalagem passa a atualizar sozinho os orçamentos e
-- pedidos ainda em negociação. A atualização é silenciosa de propósito -- não
-- interrompe quem está editando -- e por isso precisa deixar rastro: sem ele,
-- o consultor abre um orçamento com valor diferente do que mandou ao cliente e
-- não tem como saber por quê.
--
-- Cada entrada guarda quando, qual produto disparou, de quanto para quanto, e
-- os motivos em texto ("Matéria-prima subiu R$ 1,20"). É o que o consultor
-- precisa ter na mão quando o cliente pergunta.
--
-- jsonb e não tabela própria: é um log curto, sempre lido junto do documento e
-- nunca consultado por conta própria -- os outros históricos deste banco
-- (`pagamento_alteracoes`, `historico_vhsys`, `historico_contatos`) seguem o
-- mesmo caminho.
alter table public.orcamentos
  add column if not exists historico_preco jsonb not null default '[]'::jsonb;

alter table public.pedidos
  add column if not exists historico_preco jsonb not null default '[]'::jsonb;

comment on column public.orcamentos.historico_preco is
  'Mudanças de preço aplicadas automaticamente pela edição de um produto precificado. Cada item: {atualizado_em, precificacao_id, nome_produto, valor_anterior, valor_novo, motivos[], origem}.';

comment on column public.pedidos.historico_preco is
  'Mesmo formato de orcamentos.historico_preco.';
