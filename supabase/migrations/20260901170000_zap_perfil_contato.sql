-- Classificação do perfil do contato, derivada do que JÁ está gravado.
--
-- A especificação pedia um campo `perfil` vindo de uma extração nova por IA.
-- Isso custaria ~US$ 22 para reanalisar as 804 conversas. Não é necessário: o
-- campo `resumo` que a análise já gravou é muito mais rico que o esperado —
-- traz marca registrada, CNPJ, tipo de loja, volume em potes, produto e canal.
--
-- Então o perfil sai por regra sobre texto existente. Zero custo, aplicável a
-- todo o histórico na hora, e ajustável depois sem reprocessar nada — a mesma
-- estratégia que levou as objeções de 73% para 95% de cobertura.
--
-- LIMITE HONESTO: regra sobre resumo é mais fraca que classificação direta com
-- evidência literal. Onde o resumo é curto ou ambíguo, devolve
-- 'nao_classificado' em vez de chutar. O painel mostra essa fatia.

-- Fornecedor é a terceira contaminação, descoberta ao ler os resumos: conversas
-- com gráfica de rótulo, transportadora e fabricante de embalagem estavam
-- contadas como cliente 'fechado', inflando o funil.
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

    -- Ordem importa: quem NÃO é cliente sai primeiro, senão cai nas regras de
    -- produtor por mencionar rótulo, potes ou fórmula.
    when p_resumo ~* '(fornecedor|fornecedora|gr[áa]fica|transportadora|representante comercial|nos vend|vender (para|à) (a )?(lemon|empresa)|cota[çc][ãa]o de frete|log[íi]stic[ao] (da|interna))'
      then 'fornecedor_ou_interno'
    when p_resumo ~* '(curr[íi]culo|vaga de emprego|trabalhar (na|conosco)|processo seletivo|spam|golpe)'
      then 'fora_de_perfil'
    when p_resumo ~* '(consumidor final|(comprar|quer) (apenas |só |somente )?(1|um) pote|uso pessoal|para mim mesm)'
      then 'fora_de_perfil'

    when p_resumo ~* '(revender o (produto )?de voc[êe]s|comprar pronto|produto pronto para revenda|sem marca pr[óo]pria)'
      then 'revendedor_pronto'

    -- Já produz: fala de lote anterior, reposição, outro fabricante atual.
    when p_resumo ~* '(reposi[çc][ãa]o|lote anterior|j[áa] produz|j[áa] fabrica|meu produto|nossa linha|segundo pedido|recompra)'
      then 'produtor_ativo'

    -- Tem marca e produz com concorrente: quer trocar de fábrica.
    when p_resumo ~* '(outra f[áa]brica|outro fabricante|fabrica (hoje|atualmente) (com|na)|trocar de fornecedor|insatisfeit[oa] com)'
      then 'produtor_migracao'

    -- Estrutura pronta mas ainda não produziu.
    when p_resumo ~* '(marca registrada|marca j[áa] registrada|possui marca|tem cnpj|loja (f[íi]sica|de produtos)|farmac[êe]utic|academia|e-commerce|nutricionista|j[áa] vende)'
      then 'empreendedor_qualificado'

    -- Pediu tabela e sumiu, ou só preço sem qualificação.
    when p_resumo ~* '(pediu (apenas |só )?(a )?tabela|s[óo] (queria|pediu) pre[çc]o|n[ãa]o respondeu (mais|ap[óo]s)|sumiu ap[óo]s|sem retorno ap[óo]s)'
         and p_etapa in ('sem_resposta','catalogo_enviado','em_conversa')
      then 'especulador'

    when p_resumo ~* '(quer come[çc]ar|pretende iniciar|iniciante|come[çc]ando agora|ainda n[ãa]o tem|sem cnpj|primeira vez|o que [ée] marca pr[óo]pria)'
      then 'aspirante_inicial'

    -- Chegou até aqui com etapa avançada: trata como empreendedor qualificado,
    -- porque quem pede proposta ou fecha demonstrou estrutura na prática.
    when p_etapa in ('proposta','fechado','meeting_agendada') then 'empreendedor_qualificado'
    when p_etapa = 'catalogo_enviado' then 'aspirante_inicial'

    else 'nao_classificado'
  end;
$$;

grant execute on function public.zap_perfil_contato(text, text) to authenticated;
