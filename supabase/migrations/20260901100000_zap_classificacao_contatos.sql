-- Classificação de contatos: separa cliente de tráfego interno.
--
-- Medido no acervo: 63 dos 1.315 contatos falam com MAIS DE UM consultor, e
-- concentram 10.040 das 45.898 mensagens — 21,9% de tudo. Cliente real
-- raramente negocia com dois vendedores da mesma empresa; colega interno fala
-- com todos. Independente disso, 58 das 804 análises já mencionam "operacional"
-- ou "interna" no resumo escrito pela IA.
--
-- Enquanto esse tráfego contar como atendimento, comparar consultores é injusto:
-- conversa com colega tem resposta em segundos e nunca vira venda, então infla
-- a agilidade e afunda a conversão — em proporções diferentes para cada um.
--
-- NADA É APAGADO. Mensagens e análises permanecem intactas; a classificação é
-- só um filtro no momento do cálculo, e é reversível a qualquer momento.

alter table public.zap_contatos
  add column if not exists classificacao text
    not null default 'nao_classificado'
    check (classificacao in ('cliente', 'interno', 'nao_classificado'));

-- Quem classificou: 'auto' é palpite do sistema e pode ser sobrescrito sem
-- cerimônia; 'manual' é decisão humana e a heurística nunca deve desfazer.
alter table public.zap_contatos
  add column if not exists classificado_por text
    check (classificado_por in ('auto', 'manual'));

create index if not exists idx_zap_contatos_classificacao
  on public.zap_contatos (classificacao);

-- ---------------------------------------------------------------------------
-- Candidatos automáticos
-- ---------------------------------------------------------------------------
-- Marca como 'interno' os contatos presentes em duas ou mais instâncias.
--
-- É um SINAL, não uma prova: um cliente grande atendido por dois vendedores
-- cairia aqui indevidamente. Por isso grava `classificado_por = 'auto'` e nunca
-- sobrescreve o que foi decidido à mão — a revisão humana é parte do desenho,
-- não um extra.
create or replace function public.zap_classificar_automatico()
returns table (marcados integer, ja_manuais integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marcados integer;
  v_manuais integer;
begin
  select count(*) into v_manuais
  from public.zap_contatos where classificado_por = 'manual';

  with multi as (
    select remote_jid
    from public.zap_contatos
    group by remote_jid
    having count(distinct instance_name) > 1
  )
  update public.zap_contatos c
     set classificacao = 'interno',
         classificado_por = 'auto',
         updated_at = now()
    from multi m
   where c.remote_jid = m.remote_jid
     and coalesce(c.classificado_por, 'auto') <> 'manual';

  get diagnostics v_marcados = row_count;
  return query select v_marcados, v_manuais;
end
$$;

grant execute on function public.zap_classificar_automatico() to service_role;

-- ---------------------------------------------------------------------------
-- Normalização de objeções
-- ---------------------------------------------------------------------------
-- Medido: 155 objeções distintas em 351 conversas do EVERTON, quase todas com
-- frequência 1 — o modelo escreveu texto livre, então "acha caro", "preço alto"
-- e "valor acima do esperado" viraram três objeções diferentes. Ranking sobre
-- isso não significa nada.
--
-- A correção "certa" seria trocar o schema por categorias fechadas e reanalisar
-- as 804 conversas, ao custo de US$ 7,22. Esta função entrega quase o mesmo
-- resultado por zero: classifica o texto QUE JÁ EXISTE por palavra-chave, sem
-- tocar no dado original e sem chamar IA nenhuma.
--
-- Regras erradas se ajustam aqui e valem imediatamente para todo o histórico —
-- vantagem que a taxonomia no schema não teria.
create or replace function public.zap_categoria_objecao(p_texto text)
returns text
language sql
immutable
as $$
  select case
    when p_texto is null or btrim(p_texto) = '' then 'outro'
    -- A ordem importa: a primeira regra que casar vence. As mais específicas
    -- vêm antes das genéricas.
    when p_texto ~* '(pre[çc]o|caro|valor|or[çc]amento alto|desconto|barato|custo)' then 'preço'
    when p_texto ~* '(frete|entrega|transporte|envio|corre[íi]os|transportadora)' then 'frete e entrega'
    when p_texto ~* '(prazo|demora|atras|tempo de produ|urgente|r[áa]pido)' then 'prazo'
    when p_texto ~* '(pagamento|boleto|pix|parcel|cart[ãa]o|faturamento|nota fiscal)' then 'pagamento'
    when p_texto ~* '(pensar|depois|analisar|retorno|aguardar|adiar|sem pressa|mais tarde)' then 'adiamento'
    when p_texto ~* '(concorr|outro fornecedor|outra empresa|cota[çc][ãa]o com)' then 'concorrência'
    when p_texto ~* '(confian|desconfi|seguran|garantia|refer[êe]ncia|d[úu]vida sobre a empresa)' then 'desconfiança'
    when p_texto ~* '(decis|s[óo]cio|dono|aprova|gerente|diretor|respons[áa]vel)' then 'decisor ausente'
    when p_texto ~* '(estoque|dispon|falta|ruptura|sem produto)' then 'disponibilidade'
    when p_texto ~* '(f[óo]rmula|dosagem|composi|t[ée]cnic|rotulo|r[óo]tulo|registro|anvisa)' then 'dúvida técnica'
    when p_texto ~* '(quantidade|m[íi]nimo|lote|volume)' then 'quantidade mínima'
    else 'outro'
  end;
$$;

grant execute on function public.zap_categoria_objecao(text) to authenticated;
