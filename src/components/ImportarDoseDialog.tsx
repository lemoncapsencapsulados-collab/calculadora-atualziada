import { useState, useMemo, useRef } from 'react';
import { ClipboardPaste, Check, AlertTriangle, Trash2, Image as ImageIcon, Loader2, X, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Insumo, UnitType } from '@/types/formula';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ParsedItem {
  nomeOriginal: string;
  nomeEncontrado?: string;
  quantidade: number;
  unidade: string;
  encontrado: boolean;
  insumoMatch?: Insumo;
}

interface ImportarDoseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insumos: Insumo[];
  onImport: (items: ParsedItem[]) => void;
}

// Normaliza texto removendo acentos e caracteres especiais
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[()®™–—\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Busca flexível de insumos no banco
function buscarInsumo(nome: string, insumos: Insumo[]): Insumo | undefined {
  const nomeNormalizado = normalizarTexto(nome);
  
  // 1. Busca exata (normalizada)
  let match = insumos.find(i => 
    normalizarTexto(i.nome) === nomeNormalizado
  );
  if (match) return match;
  
  // 2. Nome do banco contém o nome buscado
  match = insumos.find(i => 
    normalizarTexto(i.nome).includes(nomeNormalizado)
  );
  if (match) return match;
  
  // 3. Nome buscado contém o nome do banco
  match = insumos.find(i => 
    nomeNormalizado.includes(normalizarTexto(i.nome))
  );
  if (match) return match;
  
  // 4. Busca por palavras principais (>3 caracteres)
  const palavras = nomeNormalizado.split(' ').filter(p => p.length > 3);
  for (const palavra of palavras) {
    match = insumos.find(i => 
      normalizarTexto(i.nome).includes(palavra)
    );
    if (match) return match;
  }
  
  // 5. Busca específica para vitaminas/minerais
  const vitaminaMatch = nome.match(/vitamina\s*([a-zA-Z]\d*)/i);
  if (vitaminaMatch) {
    const vitaminaTipo = vitaminaMatch[1].toUpperCase();
    match = insumos.find(i => 
      normalizarTexto(i.nome).includes(`vitamina ${vitaminaTipo.toLowerCase()}`) ||
      normalizarTexto(i.nome).includes(`vit ${vitaminaTipo.toLowerCase()}`)
    );
    if (match) return match;
  }
  
  return undefined;
}

// Função de parsing inteligente que lida com texto contínuo ou com quebras de linha
function parseTextoInsumos(texto: string, insumos: Insumo[]): ParsedItem[] {
  if (!texto.trim()) return [];
  
  // Regex para encontrar quantidade + unidade
  const regex = /(\d+(?:[.,]\d+)?)\s*(mcg|mg|g|kg|mL|L|UI|unidade|un)\b/gi;
  const matches = [...texto.matchAll(regex)];
  
  if (matches.length === 0) return [];
  
  const resultados: ParsedItem[] = [];
  let ultimaPosicao = 0;
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const posicaoMatch = match.index!;
    
    // Texto entre a última posição e esta quantidade = nome do insumo
    let nomeInsumo = texto.substring(ultimaPosicao, posicaoMatch).trim();
    
    // Limpar caracteres especiais do início e fim
    nomeInsumo = nomeInsumo
      .replace(/^[-–—:,;\s]+/, '')
      .replace(/[-–—:,;\s]+$/, '')
      .trim();
    
    if (nomeInsumo) {
      const quantidadeStr = match[1].replace(',', '.');
      const quantidade = parseFloat(quantidadeStr);
      const unidade = match[2].toLowerCase();
      
      // Normalizar unidade para o tipo esperado
      let unidadeNormalizada: string = unidade;
      if (unidade === 'un' || unidade === 'unidade') {
        unidadeNormalizada = 'unidade';
      }
      
      // Buscar no banco
      const insumoMatch = buscarInsumo(nomeInsumo, insumos);
      
      resultados.push({
        nomeOriginal: nomeInsumo,
        nomeEncontrado: insumoMatch?.nome,
        quantidade,
        unidade: unidadeNormalizada,
        encontrado: !!insumoMatch,
        insumoMatch
      });
    }
    
    // Atualizar posição para após "quantidade unidade"
    ultimaPosicao = posicaoMatch + match[0].length;
  }
  
  return resultados;
}

// Converte arquivo para base64 (sem o prefixo data:...)
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o prefixo "data:image/...;base64,"
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImportarDoseDialog({
  open,
  onOpenChange,
  insumos,
  onImport
}: ImportarDoseDialogProps) {
  const [texto, setTexto] = useState('');
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [processandoImagem, setProcessandoImagem] = useState(false);
  const [erroImagem, setErroImagem] = useState<string | null>(null);
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Parse em tempo real
  const parsedItems = useMemo(() => {
    return parseTextoInsumos(texto, insumos);
  }, [texto, insumos]);
  
  const itensEncontrados = parsedItems.filter(i => i.encontrado);
  const itensNaoEncontrados = parsedItems.filter(i => !i.encontrado);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo: 10MB');
      return;
    }

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato não suportado. Use JPEG, PNG ou WebP.');
      return;
    }

    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => setImagemPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Enviar para edge function
    setProcessandoImagem(true);
    setErroImagem(null);

    try {
      const base64 = await fileToBase64(file);
      
      console.log('Sending image to edge function, size:', base64.length);
      
      const { data, error } = await supabase.functions.invoke('extract-dose-from-image', {
        body: { image: base64 }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erro ao processar imagem');
      }
      
      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao extrair texto da imagem');
      }
      
      // Usar o texto extraído no campo de texto existente
      setTexto(data.texto);
      toast.success('Imagem processada com sucesso!');
      
    } catch (error) {
      console.error('Error processing image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar imagem';
      setErroImagem(errorMessage);
      toast.error(errorMessage);
    } finally {
      setProcessandoImagem(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setImagemPreview(null);
    setTexto('');
    setErroImagem(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleImport = () => {
    if (parsedItems.length > 0) {
      setShowConfirmacao(true);
    }
  };

  const handleConfirmarImport = () => {
    onImport(parsedItems);
    setShowConfirmacao(false);
    handleClear();
    onOpenChange(false);
  };
  
  const handleClear = () => {
    setTexto('');
    setImagemPreview(null);
    setErroImagem(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleClose = () => {
    handleClear();
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5 text-primary" />
            Importar Dose Copiada
          </DialogTitle>
          <DialogDescription>
            Cole o texto ou anexe uma imagem com as matérias-primas e quantidades.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Botão de upload de imagem */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={processandoImagem}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Anexar Imagem
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageUpload}
            />
            <span className="text-xs text-muted-foreground self-center">
              JPEG, PNG ou WebP (máx. 10MB)
            </span>
          </div>

          {/* Preview da imagem */}
          {imagemPreview && (
            <div className="relative inline-block">
              <img 
                src={imagemPreview} 
                alt="Preview da imagem" 
                className="max-h-32 rounded-md border object-contain"
              />
              <Button
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={handleRemoveImage}
                disabled={processandoImagem}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Indicador de processamento */}
          {processandoImagem && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-800 dark:text-blue-200">
                Processando imagem com IA...
              </span>
            </div>
          )}

          {/* Erro de imagem */}
          {erroImagem && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-800 dark:text-red-200">
                {erroImagem}
              </span>
            </div>
          )}

          {/* Separador */}
          {imagemPreview && (
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-muted" />
              <span className="text-xs text-muted-foreground">OU cole o texto abaixo</span>
              <div className="flex-1 border-t border-muted" />
            </div>
          )}

          {/* Instruções */}
          {!imagemPreview && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Formatos aceitos:</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• Vitamina C 500mg</li>
                <li>• Zinco bisglicinato - 15 mg</li>
                <li>• Colágeno hidrolisado (peptídeos) 300 mg Vitamina B6 5 mg...</li>
              </ul>
            </div>
          )}
          
          {/* Área de texto */}
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Cole aqui a lista de matérias-primas e quantidades..."
            className="min-h-[100px] font-mono text-sm"
            disabled={processandoImagem}
          />
          
          {/* Prévia dos itens reconhecidos */}
          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Prévia: {parsedItems.length} matéria{parsedItems.length !== 1 ? 's' : ''}-prima{parsedItems.length !== 1 ? 's' : ''} reconhecida{parsedItems.length !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  {itensEncontrados.length > 0 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                      <Check className="h-3 w-3 mr-1" />
                      {itensEncontrados.length} encontrado{itensEncontrados.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {itensNaoEncontrados.length > 0 && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {itensNaoEncontrados.length} não encontrado{itensNaoEncontrados.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
              
              <ScrollArea className="h-[180px] border rounded-md p-3">
                <div className="space-y-2">
                  {parsedItems.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded-md text-sm ${
                        item.encontrado 
                          ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
                          : 'bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {item.encontrado ? (
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className={`font-medium truncate ${item.encontrado ? 'text-green-900 dark:text-green-100' : 'text-yellow-900 dark:text-yellow-100'}`}>
                            {item.encontrado ? item.nomeEncontrado : item.nomeOriginal}
                          </p>
                          {item.encontrado && item.nomeOriginal !== item.nomeEncontrado && (
                            <p className="text-xs text-muted-foreground truncate">
                              Original: {item.nomeOriginal}
                            </p>
                          )}
                          {!item.encontrado && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                              Não encontrado no inventário
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2 flex-shrink-0">
                        {item.quantidade} {item.unidade}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex gap-2 sm:gap-2">
          {(texto || imagemPreview) && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              className="mr-auto"
              disabled={processandoImagem}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={processandoImagem}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={parsedItems.length === 0 || processandoImagem}
          >
            <ClipboardPaste className="h-4 w-4 mr-2" />
            IMPORTAR DOSE
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Popup de confirmação */}
      <AlertDialog open={showConfirmacao} onOpenChange={setShowConfirmacao}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader className="flex flex-col items-center text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-200 dark:shadow-orange-900/30">
              <ShieldAlert className="h-8 w-8 text-white" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold tracking-tight">
              ATENÇÃO
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed">
              Os preços, insumos e suas quantidades podem estar errados,{' '}
              <span className="font-bold text-orange-600 dark:text-orange-400">
                CONFIRA UM A UM ANTES SEMPRE.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 sm:justify-center">
            <AlertDialogAction
              onClick={handleConfirmarImport}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-8 py-3 text-base shadow-md"
            >
              VOU CONFERIR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
