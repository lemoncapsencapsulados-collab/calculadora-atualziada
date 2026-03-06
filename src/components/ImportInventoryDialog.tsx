import { useState } from 'react';
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportResult {
  insumos: {
    criados: number;
    atualizados: number;
    ignorados: number;
    duplicatas_mescladas: number;
    erros: string[];
  };
  embalagens: {
    criados: number;
    atualizados: number;
    ignorados: number;
    erros: string[];
  };
}

interface ImportInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportInventoryDialog({ open, onOpenChange }: ImportInventoryDialogProps) {
  const [insumosFile, setInsumosFile] = useState<File | null>(null);
  const [embalagensFile, setEmbalagensFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    if (!insumosFile && !embalagensFile) {
      toast.error('Selecione pelo menos um arquivo para importar');
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      let insumosData = null;
      let embalagensData = null;

      // Ler arquivos JSON
      if (insumosFile) {
        const text = await insumosFile.text();
        insumosData = JSON.parse(text);
      }

      if (embalagensFile) {
        const text = await embalagensFile.text();
        embalagensData = JSON.parse(text);
      }

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('import-inventory', {
        body: {
          insumos: insumosData,
          embalagens: embalagensData,
        },
      });

      if (error) throw error;

      setResult(data);

      // Mostrar toasts de sucesso
      if (data.insumos && data.insumos.criados + data.insumos.atualizados > 0) {
        toast.success(
          `Matérias-Primas: ${data.insumos.criados} criadas, ${data.insumos.atualizados} atualizadas, ${data.insumos.duplicatas_mescladas} duplicatas mescladas`
        );
      }

      if (data.embalagens && data.embalagens.criados + data.embalagens.atualizados > 0) {
        toast.success(
          `Embalagens: ${data.embalagens.criados} criadas, ${data.embalagens.atualizados} atualizadas`
        );
      }

      // Recarregar página após 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Erro na importação:', error);
      toast.error(`Erro ao importar: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setInsumosFile(null);
    setEmbalagensFile(null);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Inventário Completo</DialogTitle>
          <DialogDescription>
            Importe seus arquivos JSON de matérias-primas e embalagens. O sistema irá automaticamente mesclar duplicatas e
            converter unidades.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6">
            {/* Upload de Matérias-Primas */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Arquivo de Matérias-Primas (JSON)</label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                {insumosFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-5 w-5 text-primary" />
                      <span className="text-sm">{insumosFile.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setInsumosFile(null)}>
                      Remover
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-1">
                      Clique para selecionar ou arraste o arquivo
                    </p>
                    <p className="text-xs text-muted-foreground">MATERIAS_PRIMAS.json</p>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => setInsumosFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Upload de Embalagens */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Arquivo de Embalagens (JSON)</label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                {embalagensFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-5 w-5 text-primary" />
                      <span className="text-sm">{embalagensFile.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setEmbalagensFile(null)}>
                      Remover
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-1">
                      Clique para selecionar ou arraste o arquivo
                    </p>
                    <p className="text-xs text-muted-foreground">EMBALAGENS.json</p>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => setEmbalagensFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Duplicatas serão mescladas automaticamente</li>
                  <li>Preços serão convertidos para unidade base (kg/L)</li>
                  <li>Itens existentes terão apenas preços atualizados</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={(!insumosFile && !embalagensFile) || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  'Importar'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resultados da Importação */}
            <Alert className="border-green-500">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>Importação concluída com sucesso!</AlertDescription>
            </Alert>

            {/* Insumos */}
            {result.insumos && (
              <div className="space-y-2">
                <h3 className="font-semibold">Matérias-Primas</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded">
                    <div className="text-green-700 dark:text-green-300 font-medium">
                      {result.insumos.criados}
                    </div>
                    <div className="text-muted-foreground">Criados</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded">
                    <div className="text-blue-700 dark:text-blue-300 font-medium">
                      {result.insumos.atualizados}
                    </div>
                    <div className="text-muted-foreground">Atualizados</div>
                  </div>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded">
                    <div className="text-yellow-700 dark:text-yellow-300 font-medium">
                      {result.insumos.duplicatas_mescladas}
                    </div>
                    <div className="text-muted-foreground">Duplicatas Mescladas</div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded">
                    <div className="text-gray-700 dark:text-gray-300 font-medium">
                      {result.insumos.ignorados}
                    </div>
                    <div className="text-muted-foreground">Ignorados</div>
                  </div>
                </div>
                {result.insumos.erros.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="text-sm">Erros ({result.insumos.erros.length}):</div>
                      <ul className="list-disc list-inside text-xs mt-1">
                        {result.insumos.erros.slice(0, 5).map((erro, i) => (
                          <li key={i}>{erro}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Embalagens */}
            {result.embalagens && (
              <div className="space-y-2">
                <h3 className="font-semibold">Embalagens</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded">
                    <div className="text-green-700 dark:text-green-300 font-medium">
                      {result.embalagens.criados}
                    </div>
                    <div className="text-muted-foreground">Criadas</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded">
                    <div className="text-blue-700 dark:text-blue-300 font-medium">
                      {result.embalagens.atualizados}
                    </div>
                    <div className="text-muted-foreground">Atualizadas</div>
                  </div>
                </div>
                {result.embalagens.erros.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="text-sm">Erros ({result.embalagens.erros.length}):</div>
                      <ul className="list-disc list-inside text-xs mt-1">
                        {result.embalagens.erros.slice(0, 5).map((erro, i) => (
                          <li key={i}>{erro}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <Alert>
              <AlertDescription className="text-sm">
                A página será recarregada automaticamente em 2 segundos...
              </AlertDescription>
            </Alert>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleReset}>
                Importar Novamente
              </Button>
              <Button onClick={() => window.location.reload()}>Fechar e Recarregar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
