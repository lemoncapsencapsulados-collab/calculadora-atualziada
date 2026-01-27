import { useState, useMemo } from 'react';
import { ClipboardPaste, Check, AlertTriangle, Trash2 } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Insumo, UnitType } from '@/types/formula';

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

export default function ImportarDoseDialog({
  open,
  onOpenChange,
  insumos,
  onImport
}: ImportarDoseDialogProps) {
  const [texto, setTexto] = useState('');
  
  // Parse em tempo real
  const parsedItems = useMemo(() => {
    return parseTextoInsumos(texto, insumos);
  }, [texto, insumos]);
  
  const itensEncontrados = parsedItems.filter(i => i.encontrado);
  const itensNaoEncontrados = parsedItems.filter(i => !i.encontrado);
  
  const handleImport = () => {
    if (parsedItems.length > 0) {
      onImport(parsedItems);
      setTexto('');
      onOpenChange(false);
    }
  };
  
  const handleClear = () => {
    setTexto('');
  };
  
  const handleClose = () => {
    setTexto('');
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
            Cole o texto com os insumos e suas quantidades. Pode ser uma linha contínua ou com quebras de linha.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Instruções */}
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="font-medium mb-1">Formatos aceitos:</p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• Vitamina C 500mg</li>
              <li>• Zinco bisglicinato - 15 mg</li>
              <li>• Colágeno hidrolisado (peptídeos) 300 mg Vitamina B6 5 mg...</li>
            </ul>
          </div>
          
          {/* Área de texto */}
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Cole aqui a lista de insumos e quantidades..."
            className="min-h-[120px] font-mono text-sm"
          />
          
          {/* Prévia dos itens reconhecidos */}
          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Prévia: {parsedItems.length} insumo{parsedItems.length !== 1 ? 's' : ''} reconhecido{parsedItems.length !== 1 ? 's' : ''}
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
              
              <ScrollArea className="h-[200px] border rounded-md p-3">
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
          {texto && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={parsedItems.length === 0}
          >
            <ClipboardPaste className="h-4 w-4 mr-2" />
            IMPORTAR DOSE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
