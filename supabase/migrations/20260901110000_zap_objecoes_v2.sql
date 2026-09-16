-- Refina as regras de categoria de objeção com base no que apareceu de verdade.
--
-- A primeira versão cobriu 73% de 122 objeções reais. Analisando o balde
-- "outro", quatro padrões recorrentes apareceram — e um bug:
--
--   BUG: a regra de adiamento usava 'adiar', que NÃO casa com "adiamento".
--   Cinco objeções escritas literalmente como "adiamento de reunião",
--   "adiamento do projeto", "adiamento de retomada de contato" caíam em outro.
--
--   FALTAVA 'formalização': quatro objeções sobre CNPJ ainda não emitido,
--   CNPJ vs CPF, registro no INPI. É um gargalo real e recorrente do negócio,
--   e estava invisível diluído em "outro".
--
--   FALTAVA 'fora do portfólio': cliente pedindo fitoterápico, creme tópico,
--   linha pet — produtos que a empresa não faz. Não é objeção de venda, é
--   incompatibilidade, e misturar os dois distorce o diagnóstico.
--
--   FALTAVA 'amostra': pedido de amostra antes de fechar, duas ocorrências.
--
-- Ajustar regra aqui vale para TODO o histórico na mesma hora, sem reprocessar
-- nada e sem custo de IA — a vantagem que a taxonomia gravada no schema não
-- teria.
create or replace function public.zap_categoria_objecao(p_texto text)
returns text
language sql
immutable
as $$
  select case
    when p_texto is null or btrim(p_texto) = '' then 'outro'
    -- Ordem importa: a primeira regra que casa vence, então as específicas
    -- vêm antes das genéricas.
    when p_texto ~* '(n[ãa]o (produz|oferece|possui|trabalha com|fabrica)|fora do portf|linha pet|fitoter|n[ãa]o \s*\w* *fabrica)' then 'fora do portfólio'
    when p_texto ~* '(cnpj|cpf|inpi|registro da (marca|empresa)|formaliza)' then 'formalização'
    when p_texto ~* '(amostra|degusta|testar antes|prova do produto)' then 'amostra'
    when p_texto ~* '(pre[çc]o|caro|valor|or[çc]amento alto|desconto|barato|custo)' then 'preço'
    when p_texto ~* '(frete|entrega|transporte|envio|corre[íi]os|transportadora)' then 'frete e entrega'
    when p_texto ~* '(prazo|demora|atras|tempo de produ|urgente|r[áa]pido)' then 'prazo'
    when p_texto ~* '(pagamento|boleto|pix|parcel|cart[ãa]o|faturamento|nota fiscal|cobran)' then 'pagamento'
    when p_texto ~* '(concorr|outr[oa] (fornecedor|empresa|f[áa]brica|ind[úu]stria|profissional)|or[çc]ar em outros)' then 'concorrência'
    -- 'adia' e não 'adiar': pega adiamento, adiada, adiar.
    when p_texto ~* '(adia|pensar|analisar|aguardar|sem pressa|mais tarde|avaliando|depois d)' then 'adiamento'
    when p_texto ~* '(confian|desconfi|seguran|garantia|refer[êe]ncia|suspeit|receio)' then 'desconfiança'
    when p_texto ~* '(decis|s[óo]cio|dono|aprova|gerente|diretor|respons[áa]vel)' then 'decisor ausente'
    when p_texto ~* '(estoque|dispon|falta|ruptura|sem produto)' then 'disponibilidade'
    when p_texto ~* '(f[óo]rmula|dosagem|composi|t[ée]cnic|r[óo]tulo|rotulo|anvisa|estabilidade|gr[áa]fica|white label|logo)' then 'dúvida técnica'
    when p_texto ~* '(quantidade|m[íi]nim|lote|volume|apenas \d+|s[óo] \d+)' then 'quantidade mínima'
    when p_texto ~* '(agenda|hor[áa]rio|corrido|indispon[íi]vel|viagem|trabalho da)' then 'agenda do cliente'
    else 'outro'
  end;
$$;

grant execute on function public.zap_categoria_objecao(text) to authenticated;
