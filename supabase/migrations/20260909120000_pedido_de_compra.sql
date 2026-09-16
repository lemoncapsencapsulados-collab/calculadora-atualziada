-- Pedido de Compra: contrato que precede o pedido.
--
-- O fluxo passa a ser orcamento -> Pedido de Compra assinado -> pedido aprovado.
-- O pedido ja' existe enquanto a assinatura nao sai, marcado como pendente.
--
-- status_aprovacao fica NULO nos pedidos antigos de proposito: eles nasceram
-- antes deste fluxo e nao devem aparecer como pendentes de assinatura.

alter table public.pedidos
  add column if not exists numero_contrato text,
  add column if not exists cnpj_contratante text,
  add column if not exists status_aprovacao text,
  add column if not exists pedido_compra_dados jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pedidos_status_aprovacao_check'
  ) then
    alter table public.pedidos
      add constraint pedidos_status_aprovacao_check
      check (
        status_aprovacao is null
        or status_aprovacao in ('pendente_assinatura', 'pre_aprovado', 'aprovado')
      );
  end if;
end $$;

-- A numeracao do pedido e' por CNPJ: `{numero_contrato}-{sequencial}`.
create index if not exists pedidos_cnpj_contratante_idx
  on public.pedidos (cnpj_contratante);

create index if not exists pedidos_status_aprovacao_idx
  on public.pedidos (status_aprovacao)
  where status_aprovacao is not null;

comment on column public.pedidos.numero_contrato is
  'Numero do Contrato de Fabricacao, informado pelo consultor junto ao financeiro.';
comment on column public.pedidos.cnpj_contratante is
  'CNPJ/CPF do contratante, apenas digitos. Base do sequencial do numero do pedido.';
comment on column public.pedidos.status_aprovacao is
  'pendente_assinatura -> pre_aprovado (assinado) -> aprovado. Nulo em pedidos anteriores ao fluxo.';
comment on column public.pedidos.pedido_compra_dados is
  'Campos do Pedido de Compra v3 (produtos, condicoes, especificacao tecnica, embalagem).';

-- O numero do Contrato de Fabricacao pertence ao cliente, nao ao pedido: um
-- produtor assina um contrato e todos os seus pedidos de compra se penduram
-- nele. Fica no cadastro para que qualquer pedido novo ja' nasca vinculado.
alter table public.clientes
  add column if not exists numero_contrato text;

comment on column public.clientes.numero_contrato is
  'Numero do Contrato de Fabricacao do cliente. Herdado por todos os seus pedidos de compra.';
