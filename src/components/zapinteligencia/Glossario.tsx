/**
 * Explicações dos indicadores, dentro da própria tela.
 *
 * Sigla estatística sem definição vira decoração: quem lê "p90" e não sabe o
 * que é ou ignora o número, ou — pior — interpreta como média e conclui o
 * contrário do que o dado diz.
 */

export function Glossario() {
  const itens: { termo: string; texto: string }[] = [
    {
      termo: 'Mediana (p50)',
      texto:
        'O valor do meio: metade das respostas foi mais rápida que isso, metade mais lenta. ' +
        'É o retrato do comportamento típico, e não se desloca quando um único caso extremo aparece.',
    },
    {
      termo: 'Média',
      texto:
        'A soma dividida pela quantidade. Some com a mediana e você vê o tamanho dos extremos: ' +
        'média muito acima da mediana significa que poucos casos muito lentos estão puxando o número.',
    },
    {
      termo: 'p90',
      texto:
        'O tempo dos 10% mais lentos. Se o p90 é 13 horas, uma em cada dez pessoas esperou ' +
        'mais que isso. É o indicador de quem está sendo abandonado — a mediana nunca mostra isso.',
    },
    {
      termo: 'p99',
      texto:
        'O tempo do 1% pior. Serve para dimensionar o pior caso real, não o teórico. ' +
        'Um p99 de dias significa que existem clientes esperando dias por uma resposta.',
    },
    {
      termo: 'n = base',
      texto:
        'Quantos casos sustentam aquele número. Uma taxa de 50% sobre n=4 e outra sobre n=400 ' +
        'aparentam a mesma coisa e não são: a primeira muda com um caso a mais.',
    },
    {
      termo: 'Contato novo × recorrente',
      texto:
        'Novo é quem falou pela primeira vez naquele dia. Recorrente já existia antes, mesmo que ' +
        'fora do período consultado. Separá-los distingue atendimento de lead novo de follow-up abandonado.',
    },
  ];

  return (
    <details className="surface p-4">
      <summary className="cursor-pointer text-sm font-medium select-none">
        O que significam mediana, p90, p99 e a base (n)
      </summary>
      <dl className="mt-3 grid gap-3 md:grid-cols-2">
        {itens.map((i) => (
          <div key={i.termo}>
            <dt className="text-sm font-medium">{i.termo}</dt>
            <dd className="text-xs text-muted-foreground">{i.texto}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/**
 * Critérios do sentimento.
 *
 * Declaração honesta: as 804 análises já gravadas foram feitas SEM critério
 * explícito no prompt — a única instrução era usar "neutro" quando a conversa
 * fosse curta ou ambígua demais. O resto foi julgamento do modelo. As
 * descrições abaixo são a definição que passou a valer para análises novas, e
 * descrevem bem o padrão observado, mas não foram a regra usada no passado.
 */
export function CriteriosSentimento() {
  const criterios: { rotulo: string; cor: string; texto: string }[] = [
    {
      rotulo: 'Positivo',
      cor: 'text-success',
      texto:
        'A conversa avança e o cliente demonstra intenção concreta: pede orçamento, confirma ' +
        'recebimento de material, marca reunião, envia dados cadastrais, fecha pedido ou volta ' +
        'por conta própria. O tom é colaborativo e as dúvidas dele são de execução — prazo, ' +
        'formato, pagamento — não de decisão. Objeção pode existir, desde que tenha sido ' +
        'contornada e a conversa tenha seguido adiante.',
    },
    {
      rotulo: 'Neutro',
      cor: 'text-muted-foreground',
      texto:
        'A conversa acontece sem sinal claro em nenhuma direção. Entram aqui o cliente que pede ' +
        'informação e some sem recusar, a troca puramente operacional, a conversa que ainda está ' +
        'no começo, e todo caso curto ou ambíguo demais para concluir. É também o destino de ' +
        'conversas com muito áudio não transcrito: sem o conteúdo falado, não há base para ' +
        'afirmar entusiasmo nem recusa.',
    },
    {
      rotulo: 'Negativo',
      cor: 'text-destructive',
      texto:
        'O cliente manifesta recusa, insatisfação ou desistência explícita. Inclui reclamação ' +
        'sobre preço, prazo ou atendimento, comparação desfavorável com concorrente, desistência ' +
        'declarada, e frustração com algo que a empresa fez ou deixou de fazer. Não basta a ' +
        'venda não ter acontecido: sumir em silêncio é neutro, dizer não é negativo.',
    },
  ];

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground select-none">
        Como cada conversa é classificada
      </summary>
      <div className="mt-2 space-y-3">
        {criterios.map((c) => (
          <div key={c.rotulo}>
            <p className={`text-sm font-medium ${c.cor}`}>{c.rotulo}</p>
            <p className="text-xs text-muted-foreground">{c.texto}</p>
          </div>
        ))}
        <p className="text-xs text-muted-foreground border-l-2 border-warning pl-2">
          As {'\u2248'}800 conversas já analisadas foram classificadas antes destes critérios
          existirem no prompt — a única instrução era usar neutro quando a conversa fosse curta ou
          ambígua. As descrições acima passam a valer para análises novas e descrevem o padrão
          observado, mas não foram a regra aplicada no passado.
        </p>
      </div>
    </details>
  );
}
