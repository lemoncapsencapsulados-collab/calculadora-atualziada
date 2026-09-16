-- Taxas derivadas dentro do objeto de métricas.
--
-- O validador da §10 pegou 8 números no texto gerado que não existiam em
-- `metrics`: 79,4 · 69,2 · 82,7 · 27,9 · 18,4 · 4,7 · 3,5 · 247. Nenhum era
-- invenção — eram divisões que o modelo fez sozinho (79,4% = 309/389 de links
-- sem contexto; 69,2% = 211/305 de carteira fria).
--
-- A instrução do prompt diz "você NUNCA calcula percentuais". Ela é respeitável
-- só se o percentual já estiver pronto. Este objeto entrega todas as taxas que
-- o relatório precisa citar — inclusive a conversão ETAPA A ETAPA da §4.2, que
-- é o que aponta onde a conversa morre (a % do topo esconde isso).
create or replace function public.zap_taxas(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_usuario_id uuid
)
returns jsonb
language plpgsql
stable
as $funcao$
declare
  r jsonb;
  f jsonb; fl jsonb; c jsonb; cp jsonb; b jsonb;
  pct numeric;
begin
  r := public.zap_relatorio(p_inicio, p_fim, p_usuario_id);
  f := r->'funil'; fl := r->'funil_limpo'; c := r->'carteira';
  cp := r->'comportamento'; b := r->'base';

  return jsonb_build_object(
    -- Conversão de CADA passo em relação ao anterior, com a queda absoluta.
    -- É o que localiza o gargalo; percentual do topo dilui a perda no volume.
    'funil_passo_a_passo', jsonb_build_array(
      jsonb_build_object('etapa','contatos','valor',(f->>'contatos')::int,
        'conv_do_passo_pct', 100.0, 'queda', 0),
      jsonb_build_object('etapa','consultor_falou','valor',(f->>'consultor_falou')::int,
        'conv_do_passo_pct', round(100.0*(f->>'consultor_falou')::numeric/nullif((f->>'contatos')::numeric,0),1),
        'queda', (f->>'contatos')::int - (f->>'consultor_falou')::int),
      jsonb_build_object('etapa','cliente_respondeu','valor',(f->>'cliente_respondeu')::int,
        'conv_do_passo_pct', round(100.0*(f->>'cliente_respondeu')::numeric/nullif((f->>'consultor_falou')::numeric,0),1),
        'queda', (f->>'consultor_falou')::int - (f->>'cliente_respondeu')::int),
      jsonb_build_object('etapa','recebeu_link','valor',(f->>'recebeu_link')::int,
        'conv_do_passo_pct', round(100.0*(f->>'recebeu_link')::numeric/nullif((f->>'cliente_respondeu')::numeric,0),1),
        'queda', (f->>'cliente_respondeu')::int - (f->>'recebeu_link')::int),
      jsonb_build_object('etapa','reuniao','valor',(f->>'reuniao')::int,
        'conv_do_passo_pct', round(100.0*(f->>'reuniao')::numeric/nullif((f->>'recebeu_link')::numeric,0),1),
        'queda', (f->>'recebeu_link')::int - (f->>'reuniao')::int),
      jsonb_build_object('etapa','proposta','valor',(f->>'proposta')::int,
        'conv_do_passo_pct', round(100.0*(f->>'proposta')::numeric/nullif((f->>'reuniao')::numeric,0),1),
        'queda', (f->>'reuniao')::int - (f->>'proposta')::int),
      jsonb_build_object('etapa','fechado','valor',(f->>'fechado')::int,
        'conv_do_passo_pct', round(100.0*(f->>'fechado')::numeric/nullif((f->>'proposta')::numeric,0),1),
        'queda', (f->>'proposta')::int - (f->>'fechado')::int)
    ),
    'conversao_geral_pct', round(100.0*(f->>'fechado')::numeric/nullif((f->>'contatos')::numeric,0),2),
    'conversao_limpa_pct', round(100.0*(fl->>'fechado')::numeric/nullif((fl->>'contatos')::numeric,0),2),
    'carteira_pct', (
      select coalesce(jsonb_object_agg(k, round(100.0*v::numeric/nullif((b->>'analisadas')::numeric,0),1)), '{}'::jsonb)
      from jsonb_each_text(c) as t(k,v)
    ),
    -- Índice de especulação e carteira fria: as duas leituras que mudam a
    -- interpretação de toda taxa de conversão.
    'indice_especulacao_pct', round(100.0*coalesce((c->>'especulador')::numeric,0)/nullif((b->>'analisadas')::numeric,0),1),
    'carteira_fria_pct', round(100.0*(coalesce((c->>'aspirante_inicial')::numeric,0)
                                     +coalesce((c->>'especulador')::numeric,0))
                               /nullif((b->>'analisadas')::numeric,0),1),
    'links_sem_contexto_pct', round(100.0*(cp->>'links_sem_contexto')::numeric/nullif((cp->>'links_total')::numeric,0),1),
    'proximo_passo_pct', round(100.0*(cp->>'proximo_passo_definido')::numeric/nullif((f->>'contatos')::numeric,0),1),
    'preco_cedo_pct', round(100.0*(cp->>'preco_antes_de_qualificar')::numeric/nullif((f->>'contatos')::numeric,0),1),
    'fila_parada_pct', round(100.0*(r->'fila_parada'->>'n')::numeric/nullif((f->>'contatos')::numeric,0),1),
    'objecoes_superadas_pct', (
      select round(100.0*sum((o->>'superadas')::numeric)/nullif(sum((o->>'total')::numeric),0),1)
      from jsonb_array_elements(r->'objecoes') o
    )
  );
end
$funcao$;

grant execute on function public.zap_taxas(timestamptz, timestamptz, uuid) to authenticated;
