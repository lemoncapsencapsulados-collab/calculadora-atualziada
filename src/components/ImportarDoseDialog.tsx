import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardPaste,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InsumoAutocomplete from '@/components/InsumoAutocomplete';
import { Insumo, UnitType } from '@/types/formula';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/** O que sai daqui para a calculadora. */
export interface DoseImportada {
  insumoNome: string;
  quantidade: number;
  unidade: UnitType;
}

const UNIDADES: UnitType[] = ['mcg', 'mg', 'g', 'kg', 'mL', 'L', 'UI', 'unidade'];

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Lado maior da imagem enviada à IA. Acima disso não se ganha leitura: a
 * própria API reduz, e o que sobra é upload lento de foto de celular.
 */
const LADO_MAXIMO = 1600;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insumos: Insumo[];
  onImport: (itens: DoseImportada[]) => void;
}

/** Uma linha da conferência: o que a IA leu, e o que o consultor decidiu. */
interface Linha {
  id: string;
  /** Texto original da leitura, guardado para comparar com a imagem. */
  lido: string;
  /** Matéria-prima do inventário. Vazio enquanto ninguém escolheu. */
  insumoNome: string;
  quantidade: string;
  unidade: UnitType;
}

// ---------------------------------------------------------------------------
// Casamento com o inventário
// ---------------------------------------------------------------------------

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[()®™–—\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Acha a matéria-prima no inventário a partir do nome lido na imagem.
 *
 * A busca vai afrouxando: igual, contido, contém, palavra principal. Ela erra
 * para o lado de sugerir — é a tela de conferência que decide, e sugerir algo
 * errado que a pessoa vê e troca custa menos que não sugerir nada.
 */
function buscarInsumo(nome: string, insumos: Insumo[]): Insumo | undefined {
  const alvo = normalizarTexto(nome);
  if (!alvo) return undefined;

  let match = insumos.find((i) => normalizarTexto(i.nome) === alvo);
  if (match) return match;

  match = insumos.find((i) => normalizarTexto(i.nome).includes(alvo));
  if (match) return match;

  match = insumos.find((i) => alvo.includes(normalizarTexto(i.nome)));
  if (match) return match;

  const palavras = alvo.split(' ').filter((p) => p.length > 3);
  for (const palavra of palavras) {
    match = insumos.find((i) => normalizarTexto(i.nome).includes(palavra));
    if (match) return match;
  }

  // Vitamina é o caso em que o nome do rótulo e o do inventário mais divergem:
  // "Vitamina D3 (colecalciferol)" contra "Vit D3".
  const vitamina = nome.match(/vitamina\s*([a-zA-Z]\d*)/i);
  if (vitamina) {
    const tipo = vitamina[1].toLowerCase();
    match = insumos.find(
      (i) =>
        normalizarTexto(i.nome).includes(`vitamina ${tipo}`) ||
        normalizarTexto(i.nome).includes(`vit ${tipo}`),
    );
    if (match) return match;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Texto colado
// ---------------------------------------------------------------------------

/** Quebra "Vitamina C 500mg Zinco 15 mg" em itens. Só para o texto colado. */
function parseTextoInsumos(texto: string): { nome: string; quantidade: number; unidade: UnitType }[] {
  if (!texto.trim()) return [];

  const regex = /(\d+(?:[.,]\d+)?)\s*(mcg|mg|g|kg|mL|L|UI|unidade|un)\b/gi;
  const matches = [...texto.matchAll(regex)];
  const resultados: { nome: string; quantidade: number; unidade: UnitType }[] = [];
  let ultimaPosicao = 0;

  for (const match of matches) {
    const posicao = match.index!;
    const nome = texto
      .substring(ultimaPosicao, posicao)
      .replace(/^[-–—:,;\s]+/, '')
      .replace(/[-–—:,;\s]+$/, '')
      .trim();

    if (nome) {
      const bruta = match[2].toLowerCase();
      const unidade = (bruta === 'un' || bruta === 'unidade'
        ? 'unidade'
        : UNIDADES.find((u) => u.toLowerCase() === bruta) || 'mg') as UnitType;
      resultados.push({
        nome,
        quantidade: parseFloat(match[1].replace(',', '.')),
        unidade,
      });
    }
    ultimaPosicao = posicao + match[0].length;
  }

  return resultados;
}

// ---------------------------------------------------------------------------
// Imagem
// ---------------------------------------------------------------------------

/**
 * Reduz a foto antes de subir. Foto de celular chega com 4000px e 6 MB, passa
 * do limite da API e demora no 4G do consultor — e nada disso melhora a leitura
 * de um rótulo.
 */
function reduzirImagem(file: File): Promise<{ base64: string; mime: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
    leitor.onload = () => {
      const dataUrlOriginal = leitor.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida'));
      img.onload = () => {
        const maior = Math.max(img.width, img.height);
        const escala = maior > LADO_MAXIMO ? LADO_MAXIMO / maior : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Sem canvas (navegador antigo, modo restrito) manda como veio.
          resolve({
            base64: dataUrlOriginal.split(',')[1],
            mime: file.type,
            dataUrl: dataUrlOriginal,
          });
          return;
        }
        // Fundo branco: PNG com transparência viraria preto no JPEG.
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ base64: dataUrl.split(',')[1], mime: 'image/jpeg', dataUrl });
      };
      img.src = dataUrlOriginal;
    };
    leitor.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------

let contador = 0;
const novoId = () => `linha-${Date.now()}-${contador++}`;

/** Monta as linhas da conferência já com o palpite do inventário. */
function montarLinhas(
  itens: { nome: string; quantidade: number; unidade: UnitType }[],
  insumos: Insumo[],
): Linha[] {
  return itens.map((item) => {
    const encontrado = buscarInsumo(item.nome, insumos);
    return {
      id: novoId(),
      lido: item.nome,
      insumoNome: encontrado?.nome || '',
      quantidade: item.quantidade ? String(item.quantidade) : '',
      unidade: item.unidade,
    };
  });
}

export default function ImportarDoseDialog({ open, onOpenChange, insumos, onImport }: Props) {
  const [etapa, setEtapa] = useState<'entrada' | 'conferencia'>('entrada');
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState<string | null>(null);
  const [imagemAmpliada, setImagemAmpliada] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [observacaoIA, setObservacaoIA] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const inputArquivo = useRef<HTMLInputElement>(null);

  // Fechar e reabrir tem que começar do zero: conferência velha em imagem nova
  // é o jeito mais fácil de importar a fórmula do cliente errado.
  useEffect(() => {
    if (!open) return;
    setEtapa('entrada');
    setTexto('');
    setImagem(null);
    setImagemAmpliada(false);
    setErro(null);
    setObservacaoIA('');
    setLinhas([]);
  }, [open]);

  const prontas = useMemo(
    () => linhas.filter((l) => l.insumoNome.trim() && Number(l.quantidade) > 0),
    [linhas],
  );
  const pendentes = linhas.length - prontas.length;

  const atualizar = (id: string, campo: keyof Linha, valor: string) =>
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));

  const remover = (id: string) => setLinhas((atual) => atual.filter((l) => l.id !== id));

  const adicionarLinha = () =>
    setLinhas((atual) => [
      ...atual,
      { id: novoId(), lido: '', insumoNome: '', quantidade: '', unidade: 'mg' },
    ]);

  const lerImagem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (inputArquivo.current) inputArquivo.current.value = '';

    if (!TIPOS_ACEITOS.includes(file.type)) {
      toast.error('Formato não suportado. Use JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo: 20MB.');
      return;
    }

    setLendo(true);
    setErro(null);
    try {
      const { base64, mime, dataUrl } = await reduzirImagem(file);
      setImagem(dataUrl);

      const { data, error } = await supabase.functions.invoke('extract-dose-from-image', {
        body: { image: base64, mime },
      });
      if (error) throw new Error(error.message || 'Falha ao chamar a leitura');
      if (!data?.success) throw new Error(data?.error || 'Não foi possível ler a imagem');

      const itens: { nome: string; quantidade: number; unidade: UnitType }[] = data.itens || [];
      if (itens.length === 0) {
        setErro(
          data.observacao ||
            'Nenhuma matéria-prima foi encontrada na imagem. Tente uma foto mais nítida ou cole o texto.',
        );
        return;
      }

      setObservacaoIA(data.observacao || '');
      setTexto(data.texto || '');
      setLinhas(montarLinhas(itens, insumos));
      setEtapa('conferencia');
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao processar imagem';
      setErro(mensagem);
      toast.error(mensagem);
    } finally {
      setLendo(false);
    }
  };

  const conferirTexto = () => {
    const itens = parseTextoInsumos(texto);
    if (itens.length === 0) {
      setErro('Não reconheci nenhuma quantidade no texto. Confira o formato: "Vitamina C 500mg".');
      return;
    }
    setErro(null);
    setObservacaoIA('');
    setLinhas(montarLinhas(itens, insumos));
    setEtapa('conferencia');
  };

  const importar = () => {
    onImport(
      prontas.map((l) => ({
        insumoNome: l.insumoNome,
        quantidade: Number(l.quantidade),
        unidade: l.unidade,
      })),
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            {etapa === 'entrada' ? (
              <>
                <ClipboardPaste className="h-5 w-5 text-primary" />
                Importar dose
              </>
            ) : (
              <>
                <Check className="h-5 w-5 text-primary" />
                Conferir a fórmula
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {etapa === 'entrada'
              ? 'Envie a foto da fórmula ou cole a lista. A leitura vai para uma tela de conferência antes de entrar na calculadora.'
              : 'Compare linha por linha com a imagem. Nada entra na calculadora sem passar por aqui.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          {etapa === 'entrada' && (
            <>
              <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
                <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
                <div>
                  <Button
                    type="button"
                    onClick={() => inputArquivo.current?.click()}
                    disabled={lendo}
                  >
                    {lendo ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Lendo a imagem…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Enviar foto da fórmula
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Rótulo, tabela nutricional, receita ou print. JPEG, PNG ou WebP.
                  </p>
                </div>
                <input
                  ref={inputArquivo}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={lerImagem}
                />
              </div>

              {imagem && !lendo && (
                <div className="relative inline-block">
                  <img
                    src={imagem}
                    alt="Fórmula enviada"
                    className="max-h-32 rounded-md border object-contain"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => setImagem(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {erro && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-800 dark:text-red-200">{erro}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground">ou cole a lista</span>
                <div className="flex-1 border-t" />
              </div>

              <div className="space-y-2">
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={'Vitamina C 500mg\nZinco bisglicinato 15 mg\nColágeno hidrolisado 300mg'}
                  className="min-h-[110px] font-mono text-sm"
                  disabled={lendo}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={conferirTexto}
                  disabled={!texto.trim() || lendo}
                >
                  Conferir texto colado
                </Button>
              </div>
            </>
          )}

          {etapa === 'conferencia' && (
            <>
              <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  A leitura automática erra. <span className="font-bold">Confira uma a uma</span> —
                  nome, quantidade e unidade — antes de importar.
                </p>
              </div>

              {observacaoIA && (
                <p className="text-xs text-muted-foreground border-l-2 border-muted pl-3">
                  Ressalva da leitura: {observacaoIA}
                </p>
              )}

              {imagem && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Imagem enviada</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setImagemAmpliada((v) => !v)}
                    >
                      {imagemAmpliada ? (
                        <>
                          <Minimize2 className="h-3 w-3 mr-1" /> Reduzir
                        </>
                      ) : (
                        <>
                          <Maximize2 className="h-3 w-3 mr-1" /> Ampliar
                        </>
                      )}
                    </Button>
                  </div>
                  <img
                    src={imagem}
                    alt="Fórmula enviada"
                    className={`w-full rounded-md border object-contain bg-muted/30 ${
                      imagemAmpliada ? 'max-h-[60vh]' : 'max-h-40'
                    }`}
                  />
                </div>
              )}

              <div className="space-y-3">
                {linhas.map((linha, indice) => {
                  const semInsumo = !linha.insumoNome.trim();
                  const semQuantidade = !(Number(linha.quantidade) > 0);
                  const diferente =
                    linha.lido &&
                    linha.insumoNome &&
                    normalizarTexto(linha.lido) !== normalizarTexto(linha.insumoNome);

                  return (
                    <div
                      key={linha.id}
                      className={`rounded-lg border p-3 space-y-2 ${
                        semInsumo || semQuantidade
                          ? 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                          : 'bg-card'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground font-mono mt-2.5 w-5 shrink-0">
                          {indice + 1}
                        </span>

                        <div className="flex-1 min-w-0 grid gap-2 sm:grid-cols-[1fr_7rem_7rem]">
                          <div className="space-y-1 min-w-0">
                            <Label className="text-xs sm:hidden">Matéria-prima</Label>
                            <InsumoAutocomplete
                              insumos={insumos}
                              value={linha.insumoNome}
                              onSelect={(insumo) => atualizar(linha.id, 'insumoNome', insumo.nome)}
                              placeholder={semInsumo ? 'Escolher matéria-prima…' : undefined}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs sm:hidden">Quantidade</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min="0"
                              value={linha.quantidade}
                              placeholder="0"
                              onChange={(e) => atualizar(linha.id, 'quantidade', e.target.value)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs sm:hidden">Unidade</Label>
                            <Select
                              value={linha.unidade}
                              onValueChange={(v) => atualizar(linha.id, 'unidade', v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNIDADES.map((u) => (
                                  <SelectItem key={u} value={u}>
                                    {u}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          title="Remover esta linha"
                          onClick={() => remover(linha.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {linha.lido && (diferente || semInsumo) && (
                        <p className="text-xs text-muted-foreground pl-7">
                          Lido na imagem: <span className="font-medium">{linha.lido}</span>
                          {semInsumo && (
                            <span className="text-amber-700 dark:text-amber-400">
                              {' '}
                              — sem correspondente no inventário, escolha um ou remova a linha.
                            </span>
                          )}
                        </p>
                      )}
                      {!semInsumo && semQuantidade && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 pl-7">
                          Quantidade não foi lida. Preencha olhando a imagem.
                        </p>
                      )}
                    </div>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={adicionarLinha}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar matéria-prima que faltou
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-4 sm:p-6 pt-3 sm:pt-4 border-t flex-col-reverse sm:flex-row gap-2 sm:justify-between">
          {etapa === 'conferencia' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEtapa('entrada')}
                className="sm:mr-auto"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {pendentes > 0 && (
                  <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {pendentes} por conferir
                  </Badge>
                )}
                <Button type="button" onClick={importar} disabled={prontas.length === 0}>
                  <Check className="h-4 w-4 mr-2" />
                  Importar {prontas.length} {prontas.length === 1 ? 'item' : 'itens'}
                </Button>
              </div>
            </>
          ) : (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="sm:ml-auto">
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
