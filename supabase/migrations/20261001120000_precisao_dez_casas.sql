-- Precisão de 10 casas decimais no dinheiro.
--
-- As colunas de valor eram `numeric(15,6)`: o Postgres arredondava na SEXTA
-- casa ao gravar, independentemente do que o navegador tivesse calculado. Numa
-- fórmula micro-dosada -- vitamina a 45 mcg sobre um insumo de R$ 2.000/kg --
-- o custo por dose cai na nona casa, e o que era custo virava zero no banco.
--
-- `numeric(20,10)` dá 10 dígitos antes da vírgula e 10 depois. Alargar não
-- mexe no dado que já existe: o que estava gravado com 6 casas continua igual,
-- só passa a caber mais daqui para frente.
--
-- A escala é a mesma do `arredondarCusto` no front. As duas precisam andar
-- juntas: front mais fino que o banco é precisão que se perde na gravação,
-- banco mais fino que o front é coluna que nunca se usa.

do $$
declare
  col record;
begin
  for col in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and data_type = 'numeric'
      and numeric_precision = 15
      and numeric_scale = 6
      and table_name in ('precificacoes', 'materias_primas', 'embalagens', 'formulas', 'lotes')
  loop
    execute format(
      'alter table public.%I alter column %I type numeric(20,10)',
      col.table_name, col.column_name
    );
  end loop;
end $$;

comment on column public.materias_primas.preco_compra is
  'Preço por unidade de compra, com 10 casas. Margem apertada não sobrevive a arredondamento no meio do caminho.';

-- A densidade entra multiplicando na conversão volume<->massa, então também
-- não pode ser o elo que arredonda primeiro.
alter table public.materias_primas alter column densidade type numeric(20,10);
