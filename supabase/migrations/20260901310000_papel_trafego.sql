-- Papel `trafego`: quem pode ver custo de mídia na página de Funis de Tráfego Pago.
--
-- Este comando está SOZINHO no arquivo de propósito. `alter type ... add value`
-- não roda dentro de bloco transacional, e o Supabase envolve cada migração numa
-- transação. Acompanhado de qualquer outro DDL, a migração falha ao aplicar —
-- por isso as tabelas e políticas que usam o papel ficam na migração seguinte.

alter type public.app_role add value if not exists 'trafego';
