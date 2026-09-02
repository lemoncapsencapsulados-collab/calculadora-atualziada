import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ehGrupo, jidParaTelefone, mensagemDeErro, useZapInstancias } from '@/hooks/useZapVendas';
import {
  EtapaExportacao,
  ExportacaoCancelada,
  ProgressoExportacao,
  ResultadoExportacao,
  exportarConversaPdf,
} from '@/lib/zapConversaExport';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, CheckCircle2, Download, FileDown, Loader2 } from 'lucide-react';
import type { ChatSelecionado } from './ListaConversas';

/** Fases visíveis na tela de progresso, na ordem em que a exportação as percorre. */
const ETAPAS: { chave: Exclude<EtapaExportacao, 'concluido'>; rotulo: string }[] = [
  { chave: 'mensagens', rotulo: 'Buscar mensagens' },
  { chave: 'imagens', rotulo: 'Baixar imagens' },
  { chave: 'audios', rotulo: 'Baixar áudios' },
  { chave: 'pdf', rotulo: 'Montar o PDF' },
];

const ORDEM_ETAPA: Record<EtapaExportacao, number> = {
  mensagens: 0,
  imagens: 1,
  audios: 2,
  pdf: 3,
  concluido: 4,
};

type Fase = 'opcoes' | 'executando' | 'concluida' | 'erro';

/** Nome do vendedor dono da instância — só para carimbar o cabeçalho do PDF. */
function useVendedorDaInstancia(instanceName: string | undefined): string | undefined {
  const { data: resultado } = useZapInstancias();

  // Mesma chave usada pela lista de conversas: divide o cache em vez de refazer a busca.
  const { data: usuarios } = useQuery({
    queryKey: ['zap-usuarios-mapa'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('usuarios').select('id, nome');
      if (error) throw error;
      const mapa = new Map<string, string>();
      (data || []).forEach((u) => mapa.set(u.id, u.nome));
      return mapa;
    },
  });

  return useMemo(() => {
    if (!instanceName) return undefined;
    const instancia = (resultado?.instancias || []).find((i) => i.instanceName === instanceName);
    if (!instancia?.usuarioId) return undefined;
    return usuarios?.get(instancia.usuarioId);
  }, [instanceName, resultado, usuarios]);
}

interface ExportarConversaDialogProps {
  chat: ChatSelecionado;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
}

/**
 * Exporta a conversa aberta para PDF, com uma tela de progresso por etapa.
 *
 * A exportação é longa por natureza (pagina o histórico inteiro e baixa uma
 * mídia por vez), então o diálogo não pode ser fechado no meio: sair pelo X ou
 * pelo Esc cancelaria a operação sem o usuário perceber e deixaria downloads
 * pela metade. Enquanto roda, só o botão "Cancelar" encerra — e ele marca o
 * sinal que a exportação checa entre um passo e outro.
 */
export function ExportarConversaDialog({ chat, aberto, onAbertoChange }: ExportarConversaDialogProps) {
  const { toast } = useToast();
  const vendedor = useVendedorDaInstancia(chat.instanceName);

  const [fase, setFase] = useState<Fase>('opcoes');
  const [incluirImagens, setIncluirImagens] = useState(true);
  const [baixarAudios, setBaixarAudios] = useState(true);
  const [progresso, setProgresso] = useState<ProgressoExportacao | null>(null);
  const [resultado, setResultado] = useState<ResultadoExportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  /** Espelha `sinalRef` em estado só para a UI: uma ref sozinha não redesenha o botão. */
  const [cancelando, setCancelando] = useState(false);

  const sinalRef = useRef({ cancelado: false });

  const nomeContato = chat.pushName || jidParaTelefone(chat.remoteJid) || 'Contato';
  const grupo = ehGrupo(chat.remoteJid);

  // Cada abertura começa do zero — inclusive depois de um erro ou de um cancelamento.
  useEffect(() => {
    if (!aberto) return;
    sinalRef.current = { cancelado: false };
    setFase('opcoes');
    setProgresso(null);
    setResultado(null);
    setErro(null);
    setCancelando(false);
  }, [aberto]);

  // Se o diálogo for desmontado com uma exportação em andamento (troca de
  // conversa, navegação), o sinal precisa ser marcado — senão o laço continua
  // baixando mídia de uma conversa que ninguém está mais olhando.
  useEffect(() => () => {
    sinalRef.current.cancelado = true;
  }, []);

  const iniciar = async () => {
    sinalRef.current = { cancelado: false };
    setCancelando(false);
    setFase('executando');
    setErro(null);
    setResultado(null);
    setProgresso({ etapa: 'mensagens', descricao: 'Preparando a exportação…', concluidos: 0, total: null });

    try {
      const saida = await exportarConversaPdf({
        instanceName: chat.instanceName,
        remoteJid: chat.remoteJid,
        nomeContato,
        vendedor,
        incluirImagens,
        baixarAudios,
        onProgresso: setProgresso,
        sinal: sinalRef.current,
      });
      setResultado(saida);
      setFase('concluida');
    } catch (e) {
      if (e instanceof ExportacaoCancelada) {
        onAbertoChange(false);
        toast({ title: 'Exportação cancelada', description: 'Nenhum arquivo foi gerado.' });
        return;
      }
      setErro(mensagemDeErro(e));
      setFase('erro');
    }
  };

  const cancelar = () => {
    sinalRef.current.cancelado = true;
    setCancelando(true);
  };

  const etapaAtual = progresso?.etapa ?? 'mensagens';
  const percentual =
    progresso && progresso.total && progresso.total > 0
      ? Math.min(100, Math.round((progresso.concluidos / progresso.total) * 100))
      : null;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        // Fechar no meio da exportação abandonaria downloads pela metade sem aviso.
        if (!v && fase === 'executando') return;
        onAbertoChange(v);
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => {
          if (fase === 'executando') e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (fase === 'executando') e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Exportar conversa</DialogTitle>
          <DialogDescription>
            {grupo ? 'Grupo' : 'Contato'} <span className="font-medium text-foreground">{nomeContato}</span>
            {!grupo && (
              <>
                {' '}
                — <span className="num">{jidParaTelefone(chat.remoteJid)}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {fase === 'opcoes' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A conversa inteira será exportada em PDF — todas as mensagens, do início ao fim, e não
              só as que estão carregadas na tela.
            </p>

            <div className="space-y-3 rounded-md border border-border p-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={incluirImagens}
                  onCheckedChange={(v) => setIncluirImagens(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Incluir as imagens no PDF
                  <span className="block text-xs text-muted-foreground">
                    Cada imagem é baixada uma a uma — deixa a exportação mais lenta e o arquivo maior.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={baixarAudios}
                  onCheckedChange={(v) => setBaixarAudios(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Baixar os áudios num .zip separado
                  <span className="block text-xs text-muted-foreground">
                    Áudio não toca dentro de um PDF; os arquivos vêm num .zip com um índice ligando
                    cada um ao momento da conversa.
                  </span>
                </span>
              </label>
            </div>

            <p className="text-xs text-muted-foreground">
              Vídeos e documentos aparecem no PDF só como um rótulo com o nome do arquivo. Mídia
              antiga pode não estar mais disponível — o WhatsApp apaga arquivos do servidor depois de
              algumas semanas.
            </p>
          </div>
        )}

        {fase === 'executando' && (
          <div className="space-y-4">
            <ul className="space-y-2">
              {ETAPAS.map((etapa) => {
                const posicao = ORDEM_ETAPA[etapa.chave];
                const atualPos = ORDEM_ETAPA[etapaAtual];
                const feita = atualPos > posicao;
                const ativa = atualPos === posicao;

                return (
                  <li
                    key={etapa.chave}
                    className={cn(
                      'flex items-center gap-2.5 text-sm',
                      ativa ? 'text-foreground' : feita ? 'text-muted-foreground' : 'text-muted-foreground/60'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                        feita && 'border-primary bg-primary text-primary-foreground',
                        ativa && 'border-primary text-primary',
                        !feita && !ativa && 'border-border'
                      )}
                    >
                      {feita ? (
                        <Check className="h-3 w-3" />
                      ) : ativa ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                    </span>
                    {etapa.rotulo}
                  </li>
                );
              })}
            </ul>

            <div className="space-y-1.5">
              {percentual === null ? (
                // Total ainda desconhecido (a paginação não diz de antemão quantas
                // páginas existem): barra indeterminada em vez de um 0% mentiroso.
                <div className="h-4 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full w-full animate-pulse bg-primary/50" />
                </div>
              ) : (
                <Progress value={percentual} />
              )}
              <p className="text-xs text-muted-foreground">{progresso?.descricao}</p>
            </div>

            <p className="text-xs text-muted-foreground">
              Não feche esta janela — o download começa sozinho quando terminar.
            </p>
          </div>
        )}

        {fase === 'concluida' && resultado && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-md border border-success/30 bg-success-soft p-3 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Exportação concluída</p>
                <p className="text-xs opacity-90">
                  {resultado.totalMensagens} mensagens em {resultado.nomeArquivoPdf}
                  {resultado.nomeArquivoZip ? ` e ${resultado.nomeArquivoZip}` : ''}.
                </p>
              </div>
            </div>

            <ul className="space-y-1 text-xs text-muted-foreground">
              {incluirImagens && (
                <li>
                  {resultado.imagensIncluidas} imagens incluídas no PDF
                  {resultado.imagensIndisponiveis > 0 && ` — ${resultado.imagensIndisponiveis} não estavam mais disponíveis`}
                  .
                </li>
              )}
              {baixarAudios && (
                <li>
                  {resultado.audiosBaixados} áudios no .zip
                  {resultado.audiosIndisponiveis > 0 && ` — ${resultado.audiosIndisponiveis} não estavam mais disponíveis`}
                  .
                </li>
              )}
              <li>Emojis não são desenhados no PDF (a fonte do documento não os tem).</li>
            </ul>

            {(resultado.imagensIndisponiveis > 0 || resultado.audiosIndisponiveis > 0) && (
              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft p-2.5 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Parte das mídias antigas já foi removida dos servidores do WhatsApp e não pôde ser
                  recuperada. As mensagens continuam no PDF, marcadas como indisponíveis.
                </span>
              </div>
            )}
          </div>
        )}

        {fase === 'erro' && (
          <div className="rounded-md border border-destructive-soft bg-destructive-soft p-3 text-sm text-destructive">
            <p className="font-medium">Não foi possível exportar a conversa.</p>
            <p className="mt-1 text-xs">{erro}</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {fase === 'opcoes' && (
            <>
              <Button variant="outline" onClick={() => onAbertoChange(false)}>
                Cancelar
              </Button>
              <Button onClick={iniciar}>
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>
            </>
          )}

          {fase === 'executando' && (
            <Button variant="outline" onClick={cancelar} disabled={cancelando}>
              {cancelando ? 'Cancelando…' : 'Cancelar'}
            </Button>
          )}

          {fase === 'concluida' && <Button onClick={() => onAbertoChange(false)}>Fechar</Button>}

          {fase === 'erro' && (
            <>
              <Button variant="outline" onClick={() => onAbertoChange(false)}>
                Fechar
              </Button>
              <Button onClick={iniciar}>
                <Download className="h-4 w-4" />
                Tentar de novo
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
