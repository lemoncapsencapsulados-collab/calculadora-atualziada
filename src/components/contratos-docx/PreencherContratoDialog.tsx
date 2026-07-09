import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Download, FileText } from 'lucide-react';
import { ContratoModeloDocx, detectarVariaveis, baixarModeloArquivo } from '@/hooks/useContratoModelosDocx';
import { preencherDocxOriginal } from '@/lib/docxEditor';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  modelo: ContratoModeloDocx | null;
}

export function PreencherContratoDialog({ open, onOpenChange, modelo }: Props) {
  const html = modelo?.html_editado || '';
  const variaveis = useMemo(() => detectarVariaveis(html), [html]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [nomeArquivo, setNomeArquivo] = useState('Contrato');
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (open && modelo) {
      const inicial: Record<string, string> = {};
      variaveis.forEach((v) => (inicial[v] = ''));
      setValores(inicial);
      setNomeArquivo(modelo.nome || 'Contrato');
    }
  }, [open, modelo?.id]);

  const gerar = async () => {
    if (!modelo?.arquivo_url) {
      toast.error('Modelo sem arquivo original.');
      return;
    }
    setGerando(true);
    try {
      const buf = await baixarModeloArquivo(modelo.arquivo_url);
      const blob = preencherDocxOriginal(buf, valores);
      saveAs(blob, nomeArquivo.endsWith('.docx') ? nomeArquivo : `${nomeArquivo}.docx`);
      toast.success('Contrato gerado!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao gerar: ' + (err?.message || 'desconhecido'));
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Gerar contrato — {modelo?.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Nome do arquivo</Label>
            <Input value={nomeArquivo} onChange={(e) => setNomeArquivo(e.target.value)} />
          </div>
          {variaveis.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/30">
              Nenhuma variável <code>{'{{...}}'}</code> encontrada no modelo. O contrato será gerado como está.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Preencha as variáveis detectadas no modelo:</p>
              {variaveis.map((v) => (
                <div key={v} className="space-y-1">
                  <Label className="text-xs font-mono">{`{{${v}}}`}</Label>
                  <Textarea
                    rows={2}
                    value={valores[v] || ''}
                    onChange={(e) => setValores({ ...valores, [v]: e.target.value })}
                    placeholder="Valor a preencher"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={gerar} disabled={gerando}>
            {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Gerar e baixar DOCX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}