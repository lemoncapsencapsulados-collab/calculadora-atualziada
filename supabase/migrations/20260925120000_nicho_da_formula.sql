-- Nicho do Catálogo Lemon, espelhando as coleções de loja.lemoncaps.com.br.
--
-- Até aqui o nicho era deduzido por uma tabela em código que casava o nome da
-- fórmula com o produto da loja. Isso resolve o que já existe, mas não deixa
-- ninguém DIZER onde uma fórmula nova deve entrar -- e fórmula que a loja ainda
-- não vende não tinha como ser arquivada em lugar nenhum.
--
-- Nulo continua valendo: significa "não foi dito", e aí o mapeamento com a loja
-- decide, como antes. Só o que for escolhido à mão sobrepõe.
alter table public.formulas
  add column if not exists nicho text;

alter table public.formulas
  drop constraint if exists formulas_nicho_check;

alter table public.formulas
  add constraint formulas_nicho_check
  check (nicho is null or nicho in ('vitalidade', 'energia', 'performance', 'sono', 'beleza'));

comment on column public.formulas.nicho is
  'Nicho do Catálogo Lemon escolhido à mão. Nulo = deduzir pelo espelho da loja (src/lib/catalogoLoja.ts).';

-- A aba do catálogo lê isto em toda listagem.
create index if not exists formulas_nicho_idx on public.formulas (nicho) where nicho is not null;
