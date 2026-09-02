-- Fechamento medido pela etiqueta do consultor, não inferido pela IA.
--
-- POR QUE IMPORTA: a última etapa do funil hoje ('reunião, proposta ou
-- fechamento') é julgamento da IA sobre o conteúdo da conversa. A etiqueta PAGO
-- é fato marcado por uma pessoa que estava lá. Onde a etiqueta existe, ela vale
-- mais.
--
-- CUIDADO NECESSÁRIO: a etiqueta é subutilizada. Na conta do Emmanuel, 2
-- contatos estão marcados como PAGO contra 47 fechamentos que a IA identifica
-- no mesmo período. Não dá para simplesmente trocar uma pela outra — a troca
-- faria o painel afirmar 1 venda em 872 contatos, o que é falso. O que a
-- função devolve é o par: o número da etiqueta E a cobertura, para a tela poder
-- dizer as duas coisas e deixar a divergência à vista.
--
-- A divergência é informação: ou a etiqueta não está sendo usada, ou a IA está
-- generosa demais no que chama de fechamento. Qualquer das duas é acionável;
-- esconder uma delas não é.

create or replace function public.zap_fechamento_etiquetado(
  p_usuario_id uuid,
  p_inicio timestamptz default null,
  p_fim timestamptz default null
)
returns table (
  marcados_pago bigint,
  marcados_pago_com_conversa bigint,
  marcados_pedido_enviado bigint,
  -- Quantos contatos do consultor têm QUALQUER etiqueta. Sem isso não dá para
  -- distinguir "ninguém fechou" de "ninguém etiqueta".
  contatos_com_alguma_etiqueta bigint,
  contatos_totais bigint
)
language sql
stable
security invoker
as $funcao$
  with inst as (
    select i.instance_name
    from public.zap_instancias i
    where i.usuario_id = p_usuario_id and i.ativo
  ),
  marcados as (
    select
      ce.remote_jid,
      ce.instance_name,
      -- Comparação sem depender de grafia: 'PAGO', 'Pago' e 'pago ' convivem
      -- nas contas porque cada consultor criou a sua etiqueta.
      bool_or(upper(btrim(e.nome)) = 'PAGO') as pago,
      bool_or(upper(btrim(e.nome)) = 'PEDIDO ENVIADO') as enviado
    from public.zap_contato_etiquetas ce
    join inst on inst.instance_name = ce.instance_name
    join public.zap_etiquetas e
      on e.instance_name = ce.instance_name and e.label_id = ce.label_id
    group by ce.remote_jid, ce.instance_name
  )
  select
    count(*) filter (where m.pago)::bigint,
    count(*) filter (
      where m.pago and exists (
        select 1 from public.zap_contatos c
        where c.instance_name = m.instance_name
          and c.remote_jid = m.remote_jid
          and (p_inicio is null or c.ultima_mensagem_at >= p_inicio)
          and (p_fim    is null or c.ultima_mensagem_at <= p_fim)
      )
    )::bigint,
    count(*) filter (where m.enviado)::bigint,
    count(*)::bigint,
    (select count(*) from public.zap_contatos c
      join inst on inst.instance_name = c.instance_name
      where (p_inicio is null or c.ultima_mensagem_at >= p_inicio)
        and (p_fim    is null or c.ultima_mensagem_at <= p_fim))::bigint
  from marcados m;
$funcao$;

grant execute on function public.zap_fechamento_etiquetado(uuid, timestamptz, timestamptz)
  to authenticated, service_role;
