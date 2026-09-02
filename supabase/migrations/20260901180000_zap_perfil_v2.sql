-- Refina a classificação de perfil com base no que ficou de fora.
--
-- A v1 deixou 45% em 'nao_classificado'. Lendo os 360 casos, cinco padrões
-- explicam quase tudo:
--
--   1. Conversas NÃO comerciais (uma delas é troca de mensagens pessoais entre
--      um casal) caíam em nenhuma regra. São fora_de_perfil.
--   2. "já é parceira de marca própria da Lemon" — cliente ATIVO, e a v1 não
--      pegava porque procurava "reposição" e "lote anterior".
--   3. "sem atuação prévia no setor" — aspirante, sem regra que casasse.
--   4. Sinais fortes de estrutura que a v1 ignorava: pagou amostras, reunião com
--      sócia, dados cadastrais, participou de call.
--   5. 316 dos 360 estavam em 'em_conversa' — meio de funil sem palavra-chave.
--      Sem fallback para essa etapa, quase metade da carteira ficava invisível.
create or replace function public.zap_perfil_contato(
  p_resumo text,
  p_etapa text
)
returns text
language sql
immutable
as $$
  select case
    when p_resumo is null or length(btrim(p_resumo)) < 40 then 'nao_classificado'

    -- Quem NÃO é cliente sai primeiro: senão cai em regra de produtor por
    -- mencionar rótulo, potes ou fórmula.
    when p_resumo ~* '(n[ãa]o [ée] (um )?atendimento comercial|mensagens pessoais|assunto pessoal|conversa (pessoal|familiar)|casal)'
      then 'fora_de_perfil'
    when p_resumo ~* '(fornecedor|fornecedora|gr[áa]fica|transportadora|representante comercial|cota[çc][ãa]o de frete|log[íi]stic[ao] (da|interna)|setor (interno|de log))'
      then 'fornecedor_ou_interno'
    when p_resumo ~* '(curr[íi]culo|vaga de emprego|trabalhar (na|conosco)|processo seletivo|spam|golpe)'
      then 'fora_de_perfil'
    when p_resumo ~* '(consumidor final|(comprar|quer) (apenas |só |somente )?(1|um) pote|uso pessoal|para mim mesm)'
      then 'fora_de_perfil'
    when p_resumo ~* '(revender o (produto )?de voc[êe]s|comprar pronto|produto pronto para revenda)'
      then 'revendedor_pronto'

    -- Cliente que já produz. "parceir(a|o) de marca própria" era o padrão mais
    -- comum e a v1 não o cobria.
    when p_resumo ~* '(reposi[çc][ãa]o|lote anterior|j[áa] produz|j[áa] fabrica|meu produto|nossa linha|segundo pedido|recompra|parceir[ao] de marca pr[óo]pria|j[áa] [ée] (cliente|parceir)|cliente (ativo|antigo|recorrente))'
      then 'produtor_ativo'
    when p_resumo ~* '(outra f[áa]brica|outro fabricante|fabrica (hoje|atualmente) (com|na)|trocar de fornecedor|insatisfeit[oa] com)'
      then 'produtor_migracao'

    -- Estrutura comprovada. Pagar amostra e levar sócio à reunião são sinais
    -- mais fortes que declarar CNPJ.
    when p_resumo ~* '(marca registrada|marca j[áa] registrada|possui marca|tem cnpj|loja (f[íi]sica|de produtos)|farmac[êe]utic|academia|e-commerce|nutricionista|j[áa] vende|pagou (pelas |as )?amostras|com (a |o )?s[óo]ci[ao]|dados cadastrais|participou de call|reuni[ãa]o realizada)'
      then 'empreendedor_qualificado'

    when p_resumo ~* '(pediu (apenas |só )?(a )?tabela|s[óo] (queria|pediu) pre[çc]o|n[ãa]o respondeu (mais|ap[óo]s)|sumiu ap[óo]s|sem retorno ap[óo]s)'
         and p_etapa in ('sem_resposta','catalogo_enviado','em_conversa')
      then 'especulador'

    when p_resumo ~* '(quer come[çc]ar|pretende iniciar|iniciante|come[çc]ando agora|ainda n[ãa]o tem|sem cnpj|primeira vez|o que [ée] marca pr[óo]pria|sem atua[çc][ãa]o pr[ée]via|sem experi[êe]ncia)'
      then 'aspirante_inicial'

    -- Fallback por etapa: quem pediu proposta ou fechou demonstrou estrutura na
    -- prática, independente do que o resumo diz.
    when p_etapa in ('proposta','fechado','meeting_agendada') then 'empreendedor_qualificado'
    -- 316 dos 360 não classificados estavam aqui. Meio de funil sem sinal de
    -- estrutura é, por definição, alguém ainda se qualificando.
    when p_etapa in ('catalogo_enviado','em_conversa') then 'aspirante_inicial'
    when p_etapa in ('sem_resposta','perdido') then 'especulador'

    else 'nao_classificado'
  end;
$$;

grant execute on function public.zap_perfil_contato(text, text) to authenticated;
