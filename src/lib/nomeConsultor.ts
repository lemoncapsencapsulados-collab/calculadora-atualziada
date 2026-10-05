/**
 * Um vendedor, um nome.
 *
 * O mesmo vendedor aparece escrito de três jeitos no sistema: o nome que o
 * consultor digitou no orçamento ("RUBIA MARA", "Rubia Mara", "Rubia"), o nome
 * da instância do WhatsApp ("guilherme magano") e o nome do cadastro
 * ("Guilherme Magano"). Sem juntar, o painel lista a mesma pessoa várias vezes,
 * cada linha com um pedaço dos números -- foi exatamente o que aconteceu.
 *
 * O cadastro em `usuarios` é a referência: é o único lugar onde o nome foi
 * escrito uma vez só e onde a instância do WhatsApp está amarrada à pessoa.
 */

export interface ConsultorCadastrado {
  nome: string;
  /** Nome da instância do WhatsApp dele, quando existe. */
  instancia?: string | null;
}

/** Sem acento, sem caixa, sem espaço dobrado. */
export function chaveNome(nome: string | null | undefined): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve qualquer grafia para o nome do cadastro.
 *
 * Três tentativas, da mais segura para a menos:
 *  1. o nome bate exatamente (sem acento e sem caixa);
 *  2. é o nome da instância do WhatsApp daquela pessoa;
 *  3. é um começo de nome que serve a UM cadastro só -- "Rubia" para
 *     "RUBIA MARA". Se servir a dois, não resolve: juntar duas pessoas que
 *     compartilham o primeiro nome seria pior que deixá-las separadas.
 *
 * Sem correspondência, devolve o que veio: um vendedor que não está no cadastro
 * não pode sumir do relatório.
 */
export function resolverConsultor(
  nomeDigitado: string | null | undefined,
  cadastro: ConsultorCadastrado[],
): string {
  const bruto = (nomeDigitado || '').trim();
  if (!bruto) return '';
  const chave = chaveNome(bruto);

  const exato = cadastro.find((c) => chaveNome(c.nome) === chave);
  if (exato) return exato.nome;

  const porInstancia = cadastro.find((c) => c.instancia && chaveNome(c.instancia) === chave);
  if (porInstancia) return porInstancia.nome;

  const comecam = cadastro.filter((c) => chaveNome(c.nome).startsWith(`${chave} `));
  if (comecam.length === 1) return comecam[0].nome;

  return bruto;
}
