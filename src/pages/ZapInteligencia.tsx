import { useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Brain,
  Clock,
  MessageSquareOff,
  Mic,
  Video,
  Image as ImageIcon,
  FileText,
  Link2,
  ShieldAlert,
  Loader2,
  Sparkles,
  AlertTriangle,
  Square,
  Download,
  TrendingUp,
  CalendarClock,
  ShieldQuestion,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTemPapel } from '@/hooks/useTemPapel';
import { mensagemErroEdgeFunction } from '@/lib/erroEdgeFunction';
import { gerarPdfParecer } from '@/lib/zapParecerPdf';
import {
  useZapInteligencia,
  formatarDuracao,
  taxa,
  type ParecerCompleto,
} from '@/hooks/useZapInteligencia';
import Apresentacoes from '@/components/zapinteligencia/Apresentacoes';
import FiltroPesquisa, { TelaCarregando, type Pesquisa } from '@/components/zapinteligencia/FiltroPesquisa';
import { Glossario, CriteriosSentimento } from '@/components/zapinteligencia/Glossario';
import {
  GraficoDistribuicao,
  GraficoObjecoes,
  GraficoSerie,
  Heatmap,
} from '@/components/zapinteligencia/Graficos';

export default function ZapInteligencia() {
  const { temPapel, carregando: carregandoPapel } = useTemPapel('zapvendas');

  // Só o que já foi PESQUISADO. Enquanto for nulo, o painel não consulta nada —
  // o usuário monta consultor e período com calma e aperta "Fazer pesquisa".
  const [pesquisa, setPesquisa] = useState<Pesquisa | null>(() => {
    // Restaura a última pesquisa ao reabrir a aba. Sem isso, fechar e voltar
    // exigia remontar consultor e período do zero.
    try {
      const bruto = localStorage.getItem('zap-inteligencia-pesquisa');
      if (!bruto) return null;
      const p = JSON.parse(bruto);
      return { ...p, inicio: new Date(p.inicio), fim: new Date(p.fim) } as Pesquisa;
    } catch {
      // Formato antigo ou storage bloqueado — começa limpo, sem quebrar a tela.
      return null;
    }
  });

  const aplicarPesquisa = (p: Pesquisa) => {
    setPesquisa(p);
    try {
      localStorage.setItem('zap-inteligencia-pesquisa', JSON.stringify(p));
    } catch {
      // Navegador em modo privado: a pesquisa vale para esta sessão e ponto.
    }
  };
  const [parecer, setParecer] = useState<ParecerCompleto | null>(null);
  const [gerando, setGerando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [progresso, setProgresso] = useState<
    { feitas: number; restantes: number; porMinuto: number | null } | null
  >(null);
  // `useRef` e não estado: o laço precisa LER o valor atual a cada volta, e uma
  // variável de estado ficaria congelada no valor do render que a criou.
  const cancelar = useRef(false);

  // Datas neutras enquanto não há pesquisa: o hook está desligado nesse estado,
  // então os valores nunca chegam ao banco.
  const inicio = pesquisa?.inicio ?? new Date();
  const fim = pesquisa?.fim ?? new Date();
  const rotuloPeriodo = pesquisa?.rotulo ?? '';
  // "agosto de 2026" é cômodo mas ambíguo: não diz se o mês entrou inteiro nem
  // onde o recorte começa. As datas exatas acompanham o rótulo em toda parte.
  const intervaloPeriodo = pesquisa
    ? `${format(pesquisa.inicio, 'dd/MM/yyyy')} a ${format(pesquisa.fim, 'dd/MM/yyyy')}`
    : '';
  const periodoCompleto = pesquisa ? `${rotuloPeriodo} (${intervaloPeriodo})` : '';

  const d = useZapInteligencia(inicio, fim, pesquisa?.usuarioId ?? null, Boolean(pesquisa));
  const { metricas, usuarioIdEfetivo: idEfetivo, custo, carregando, recarregar, erro } = d;
  const m = d.selecionado;

  const parecerVisivel = parecer ?? d.parecerSalvo;

  // O nome vem do seletor, não das métricas: durante o carregamento `m` ainda é
  // nulo, e é exatamente aí que o usuário precisa conferir se pediu o certo.
  const nomeConsultor =
    m?.consultor ??
    d.consultores.find((c) => c.usuario_id === pesquisa?.usuarioId)?.consultor ??
    null;

  const analisarPeriodo = async () => {
    cancelar.current = false;
    setAnalisando(true);
    let feitas = 0;
    try {
      // Teto de rodadas como rede de segurança: um bug que impedisse `restantes`
      // de zerar rodaria para sempre, gastando dinheiro a cada volta.
      for (let rodada = 0; rodada < 60; rodada++) {
        if (cancelar.current) break;
        const { data, error } = await supabase.functions.invoke('zap-analisar', {
          body: {
            inicio: inicio.toISOString(),
            fim: fim.toISOString(),
            // 200 e não 25: a função agora analisa em paralelo dentro de um
            // orçamento de 300s. Lotes pequenos pagavam uma partida a frio e
            // uma ida e volta de rede a cada punhado de conversas.
            limite: 200,
            // Só o consultor da tela. Sem isto o botão analisava o time inteiro
            // a partir de um painel individual, e o contador enganava.
            usuario_id: idEfetivo,
          },
        });
        if (error) throw new Error(await mensagemErroEdgeFunction(error, 'Falha ao analisar'));
        if ((data as any)?.error) throw new Error((data as any).error);

        const r = data as {
          analisadas: number;
          restantes: number;
          ultimo_erro: string | null;
          ritmo?: { por_minuto: number };
        };
        feitas += r.analisadas || 0;
        setProgresso({ feitas, restantes: r.restantes ?? 0, porMinuto: r.ritmo?.por_minuto ?? null });
        // Recarregar aqui invalidava seis consultas do painel a CADA rodada, e
        // a rodada seguinte só saía depois. Era metade do tempo total gasto
        // redesenhando números que ninguém olha no meio da varredura — o
        // recarregamento acontece uma vez, no fim.

        if (!r.restantes) break;
        // Nada analisado com fila cheia significa que TODAS falharam; insistir
        // só repetiria o erro. `ultimo_erro` carrega a causa real.
        if (!r.analisadas) throw new Error(r.ultimo_erro || 'Nenhuma conversa pôde ser analisada.');
      }
      toast.success(`${m?.consultor ?? 'Consultor'}: ${feitas} conversas analisadas`);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao analisar');
    } finally {
      setAnalisando(false);
      // Uma vez só, com a fila parada: agora os números valem a pena redesenhar.
      recarregar();
    }
  };

  const gerarParecer = async () => {
    if (!idEfetivo) return;
    setGerando(true);
    setParecer(null);
    try {
      const { data, error } = await supabase.functions.invoke('zap-parecer', {
        body: {
          usuario_id: idEfetivo,
          // ISO completo, não 'yyyy-MM-dd': data pura vira meia-noite e o último
          // dia do período ficaria de fora das métricas do parecer.
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
        },
      });
      if (error) throw new Error(await mensagemErroEdgeFunction(error, 'Não foi possível gerar o parecer'));
      if ((data as any)?.error) throw new Error((data as any).error);
      setParecer((data as any).parecer as ParecerCompleto);
      recarregar();
      toast.success('Parecer gerado');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível gerar o parecer');
    } finally {
      setGerando(false);
    }
  };

  const exportarPdf = () => {
    if (!m || !parecerVisivel) return;
    try {
      gerarPdfParecer({
        metricas: m,
        parecer: parecerVisivel,
        objecoes: d.objecoes,
        periodoInicio: inicio,
        periodoFim: fim,
      });
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao gerar o PDF');
    }
  };

  if (carregandoPapel) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!temPapel) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 mx-auto text-destructive" />
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Este painel expõe o conteúdo das conversas dos consultores e é limitado a quem tem o papel
          <code className="mx-1">zapvendas</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="anuncios-neon min-h-screen">
      <div className="container mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl grid place-items-center bg-primary/15 border border-primary/30">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Inteligência de Atendimento</h1>
            <p className="text-sm text-muted-foreground">
              {/* Cai no nome vindo do seletor quando as métricas ainda não
                  chegaram: o cabeçalho não pode ficar mudo durante a espera. */}
              {[nomeConsultor, periodoCompleto].filter(Boolean).join(' · ') ||
                'Escolha o consultor e o período'}
            </p>
          </div>
        </div>

        <FiltroPesquisa
          consultores={d.consultores}
          carregando={carregando}
          onPesquisar={aplicarPesquisa}
        />

        {!pesquisa ? (
          <div className="surface p-10 text-center space-y-2">
            <p className="text-sm font-medium">Escolha o consultor e o período</p>
            <p className="text-sm text-muted-foreground">
              Nada é consultado até você apertar em <strong>Fazer pesquisa</strong>.
            </p>
          </div>
        ) : carregando ? (
          <TelaCarregando
            consultor={nomeConsultor}
            periodo={periodoCompleto}
            onVoltar={() => setPesquisa(null)}
          />
        ) : (
          <>
        {/* Análise por IA */}
        {custo && (
          <div className="surface p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-medium flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" /> Análise por IA
                </h2>
                <p className="text-sm text-muted-foreground">
                  {custo.conversas_para_analisar > 0 ? (
                    <>
                      <strong>{custo.conversas_para_analisar}</strong> conversas de{' '}
                      {m?.consultor ?? 'este consultor'} em {rotuloPeriodo} aguardando análise · custo{' '}
                      <strong>US$ {Number(custo.custo_analise_usd).toFixed(2)}</strong>
                    </>
                  ) : (
                    <>Todas as conversas de {m?.consultor ?? 'este consultor'} em {rotuloPeriodo} já foram analisadas.</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {analisando && (
                  <Button variant="outline" size="sm" onClick={() => (cancelar.current = true)}>
                    <Square className="w-3.5 h-3.5 mr-1" /> Parar
                  </Button>
                )}
                <Button onClick={analisarPeriodo} disabled={analisando || custo.conversas_para_analisar === 0}>
                  {analisando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  {analisando ? 'Analisando…' : 'Começar análise com IA'}
                </Button>
              </div>
            </div>

            {progresso && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {progresso.feitas} analisadas
                    {progresso.porMinuto ? ` · ${progresso.porMinuto}/min` : ''}
                  </span>
                  <span>
                    {progresso.restantes} restantes
                    {progresso.porMinuto && progresso.restantes
                      ? ` · ~${Math.ceil(progresso.restantes / progresso.porMinuto)} min`
                      : ''}
                  </span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${
                        progresso.feitas + progresso.restantes > 0
                          ? (progresso.feitas / (progresso.feitas + progresso.restantes)) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {custo && custo.audios_pendentes > 0 && (
          <div className="surface p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-warning shrink-0" />
            <p>
              <strong>{custo.audios_pendentes} áudios</strong> ({custo.minutos_pendentes} min) não foram
              transcritos. A análise desses trechos fica cega — o que o cliente falou por áudio não entra
              em nenhum número desta tela.
            </p>
          </div>
        )}

        {erro ? (
          <div className="surface p-5 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
            <div>
              <p className="font-medium">Não foi possível carregar as métricas</p>
              <p className="text-muted-foreground">{erro}</p>
            </div>
          </div>
        ) : !m ? (
          <div className="surface p-8 text-center text-sm text-muted-foreground">
            Nenhum atendimento registrado para {' '}
            {d.consultores.find((c) => c.usuario_id === pesquisa.usuarioId)?.consultor ?? 'este consultor'}
            {' '} em {periodoCompleto}.
          </div>
        ) : (
          <>
            {/* Agilidade */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card
                icone={<Clock className="w-4 h-4" />}
                titulo="Tempo até a 1ª resposta"
                valor={formatarDuracao(m.tmr1_mediana_seg)}
                linhas={[
                  `média ${formatarDuracao(m.tmr1_media_seg)}`,
                  `p90 ${formatarDuracao(m.tmr1_p90_seg)} · p99 ${formatarDuracao(m.tmr1_p99_seg)}`,
                  `base: ${m.contatos_cliente_iniciou} conversas`,
                ]}
              />
              <Card
                icone={<Clock className="w-4 h-4" />}
                titulo="Resposta durante a conversa"
                valor={formatarDuracao(m.resposta_continua_mediana_seg)}
                linhas={[
                  `p90 ${formatarDuracao(m.resposta_continua_p90_seg)}`,
                  `p99 ${formatarDuracao(m.resposta_continua_p99_seg)}`,
                ]}
              />
              <Card
                icone={<CalendarClock className="w-4 h-4" />}
                titulo="O cliente responde em"
                valor={formatarDuracao(m.resposta_cliente_mediana_seg)}
                linhas={[`p90 ${formatarDuracao(m.resposta_cliente_p90_seg)}`]}
              />
              <Card
                icone={<MessageSquareOff className="w-4 h-4" />}
                titulo="Prospecção sem resposta"
                valor={m.vacuo_inicial_pct == null ? '—' : `${m.vacuo_inicial_pct}%`}
                linhas={[`base: ${m.contatos_consultor_iniciou} abordagens dele`]}
              />
            </div>

            <Glossario />

            {/* Funil */}
            <Bloco titulo="Funil de atendimento">
              {d.funil.map((e) => {
                const topo = d.funil[0]?.valor || 1;
                const pct = (e.valor / topo) * 100;
                return (
                  <div key={e.rotulo} className="space-y-1">
                    <div className="flex justify-between items-baseline text-sm">
                      <span className="flex items-center gap-1.5">
                        {e.rotulo}
                        {!e.deterministica && <SeloIA />}
                      </span>
                      <span className="font-semibold">{e.valor}</span>
                    </div>
                    <div className="h-2 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% do topo</p>
                  </div>
                );
              })}
            </Bloco>

            <div className="grid gap-4 lg:grid-cols-2">
              <Bloco titulo="Distribuição do tempo de resposta">
                <GraficoDistribuicao dados={d.distribuicao} />
              </Bloco>
              <Bloco titulo="Quando ele atende">
                <Heatmap dados={d.heatmap} />
              </Bloco>
            </div>

            <Bloco titulo="Evolução no período">
              <GraficoSerie dados={d.serie} />
              <p className="text-xs text-muted-foreground">
                Linhas cheias: volume de contatos no dia (eixo da esquerda). Tracejadas: tempo até a
                primeira resposta (eixo da direita). Novo é quem falou pela primeira vez naquele dia;
                recorrente já existia antes, mesmo fora do período consultado.
              </p>
            </Bloco>

            {/* Mídia */}
            <Bloco titulo="Engajamento e mídia">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 text-sm">
                <Metrica icone={<Mic className="w-4 h-4" />} rotulo="Áudios" valor={m.audios_enviados}
                  detalhe={`${(m.audios_enviados / Math.max(m.contatos, 1)).toFixed(1)} por contato`} />
                <Metrica icone={<Video className="w-4 h-4" />} rotulo="Vídeos" valor={m.videos_enviados} />
                <Metrica icone={<ImageIcon className="w-4 h-4" />} rotulo="Imagens" valor={m.imagens_enviadas} />
                <Metrica icone={<FileText className="w-4 h-4" />} rotulo="Documentos" valor={m.documentos_enviados} />
                <Metrica icone={<Link2 className="w-4 h-4" />} rotulo="Receberam link" valor={m.contatos_com_link}
                  detalhe={taxa(m.contatos_com_link, m.contatos)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Não há taxa de clique: o WhatsApp não informa se o link foi aberto. Mede-se o envio.
              </p>
            </Bloco>

            {/* Sentimento */}
            <Bloco titulo="Sentimento das conversas">
              <div className="-mt-1">
                <p className="text-xs text-muted-foreground">
                  cobertura: {d.coberturaIA.analisadas} de {d.coberturaIA.total} conversas ({d.coberturaIA.pct}%)
                </p>
                <CriteriosSentimento />
              </div>
              {d.coberturaIA.analisadas === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conversa analisada neste período ainda.</p>
              ) : (
                (
                  [
                    ['Positivo', m.sentimento_positivo, 'bg-success'],
                    ['Neutro', m.sentimento_neutro, 'bg-muted-foreground'],
                    ['Negativo', m.sentimento_negativo, 'bg-destructive'],
                  ] as const
                ).map(([rotulo, valor, cor]) => {
                  const pct = (valor / Math.max(d.coberturaIA.analisadas, 1)) * 100;
                  return (
                    <div key={rotulo} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{rotulo}</span>
                        <span className="font-semibold">
                          {valor} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded bg-muted overflow-hidden">
                        <div className={`h-full ${cor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </Bloco>

            <Bloco titulo="Objeções recebidas">
              <p className="text-xs text-muted-foreground -mt-1 flex items-center gap-1.5">
                <ShieldQuestion className="w-3.5 h-3.5" />
                A barra verde é a parte contornada. Objeção que nunca é contornada trava a venda.
              </p>
              <GraficoObjecoes dados={d.objecoes} />
            </Bloco>

            {/* Parecer */}
            <div className="surface p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Parecer e plano de ação
                </h2>
                <div className="flex items-center gap-2">
                  {parecerVisivel && (
                    <Button variant="outline" size="sm" onClick={exportarPdf}>
                      <Download className="w-4 h-4 mr-1" /> Exportar PDF
                    </Button>
                  )}
                  <Button size="sm" onClick={gerarParecer} disabled={gerando || !idEfetivo}>
                    {gerando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    {gerando ? 'Gerando…' : parecerVisivel ? 'Refazer parecer' : 'Gerar parecer'}
                  </Button>
                </div>
              </div>

              {!parecerVisivel ? (
                <p className="text-sm text-muted-foreground">
                  O parecer é gerado a partir dos números acima e das análises de conversa — não relê as
                  mensagens, por isso sai em segundos e custa centavos.
                </p>
              ) : (
                <div className="space-y-5 text-sm leading-relaxed">
                  {!parecer && d.parecerSalvo?.created_at && (
                    <p className="text-xs text-muted-foreground">
                      Gerado em {format(new Date(d.parecerSalvo.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  )}

                  {!!parecerVisivel.pontos_impacto?.length && (
                    <div className="space-y-2">
                      <h3 className="font-medium flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" /> Os três pontos de maior impacto
                      </h3>
                      {parecerVisivel.pontos_impacto.map((p, i) => (
                        <div key={i} className="border-l-2 border-primary/40 pl-3">
                          <p className="font-medium">{p.titulo}</p>
                          <p className="text-muted-foreground">{p.porque}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!!parecerVisivel.plano_acao_itens?.length && (
                    <div className="space-y-2">
                      <h3 className="font-medium">Plano de ação</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b border-border">
                              <th className="py-2 pr-3 font-medium">#</th>
                              <th className="py-2 pr-3 font-medium">O que fazer</th>
                              <th className="py-2 pr-3 font-medium">Indicador</th>
                              <th className="py-2 pr-3 font-medium">Hoje</th>
                              <th className="py-2 pr-3 font-medium">Meta</th>
                              <th className="py-2 font-medium">Prazo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parecerVisivel.plano_acao_itens.map((a, i) => (
                              <tr key={i} className="border-b border-border/50 align-top">
                                <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                                <td className="py-2 pr-3">{a.acao}</td>
                                <td className="py-2 pr-3 text-muted-foreground">{a.metrica}</td>
                                <td className="py-2 pr-3">{a.valor_atual}</td>
                                <td className="py-2 pr-3 font-medium">{a.meta}</td>
                                <td className="py-2 whitespace-nowrap">{a.prazo}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <BlocoTexto titulo="Eficiência e agilidade" texto={parecerVisivel.eficiencia} />
                  <BlocoTexto titulo="Processo e modus operandi" texto={parecerVisivel.processo} />
                  <BlocoTexto titulo="Qualidade do relacionamento" texto={parecerVisivel.relacionamento} />
                  {parecerVisivel.comparativo_time && (
                    <BlocoTexto titulo="Comparado ao time" texto={parecerVisivel.comparativo_time} />
                  )}
                  {!parecerVisivel.plano_acao_itens?.length && (
                    <BlocoTexto titulo="Plano de ação" texto={parecerVisivel.plano_acao} />
                  )}
                </div>
              )}
            </div>

            {/* Apresentações versionadas: fica DEPOIS do painel porque só faz
                sentido gerar depois de olhar os números que vão para dentro dela. */}
            <Apresentacoes
              usuarioId={idEfetivo}
              consultorNome={m.consultor}
              inicio={inicio}
              fim={fim}
              onGerado={recarregar}
            />

            {m.contatos_internos_excluidos > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {m.contatos_internos_excluidos} contatos identificados como internos ficaram fora de todos
                os números desta tela. Nada foi apagado — eles continuam no acervo.
              </p>
            )}
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="surface p-5 space-y-3">
      <h2 className="font-medium">{titulo}</h2>
      {children}
    </div>
  );
}

function SeloIA() {
  return (
    <span
      className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1"
      title="Etapa inferida pela IA a partir do conteúdo da conversa, não contada diretamente"
    >
      IA
    </span>
  );
}

function Card({
  icone,
  titulo,
  valor,
  linhas,
}: {
  icone: React.ReactNode;
  titulo: string;
  valor: string;
  linhas: string[];
}) {
  return (
    <div className="surface p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icone}
        {titulo}
      </div>
      <div className="text-2xl font-semibold">{valor}</div>
      {/* A base entra junto do número de propósito: comparar sobre denominadores
          diferentes é o erro mais fácil de cometer aqui. */}
      {linhas.map((l) => (
        <p key={l} className="text-xs text-muted-foreground">
          {l}
        </p>
      ))}
    </div>
  );
}

function Metrica({
  icone,
  rotulo,
  valor,
  detalhe,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number;
  detalhe?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icone}</span>
      <div>
        <div className="text-muted-foreground text-xs">{rotulo}</div>
        <div className="font-semibold">{valor}</div>
        {detalhe && <div className="text-xs text-muted-foreground">{detalhe}</div>}
      </div>
    </div>
  );
}

function BlocoTexto({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="space-y-1">
      <h3 className="font-medium text-foreground">{titulo}</h3>
      <p className="whitespace-pre-wrap text-foreground/90">{texto}</p>
    </div>
  );
}
