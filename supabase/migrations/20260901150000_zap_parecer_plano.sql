-- Plano de ação estruturado no parecer.
--
-- Hoje `plano_acao` é texto corrido. Para virar tabela no PDF que o consultor
-- recebe — e para dar para acompanhar se a meta foi batida no ciclo seguinte —
-- cada ação precisa dos seus campos separados: o que fazer, qual métrica move,
-- de quanto para quanto, e até quando.
--
-- A coluna antiga permanece: pareceres já gerados continuam legíveis, e a tela
-- cai nela quando o registro é anterior a esta mudança.
alter table public.zap_consultor_parecer
  add column if not exists plano_acao_itens jsonb;

alter table public.zap_consultor_parecer
  add column if not exists comparativo_time text;

alter table public.zap_consultor_parecer
  add column if not exists pontos_impacto jsonb;
