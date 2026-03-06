import { useState } from 'react';
import { Upload, FileJson, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useImportInsumos, InsumoImport, ImportResponse } from '@/hooks/useImportInsumos';
import { formatCurrency } from '@/lib/unitConversion';

export default function ImportInsumosDialog() {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<InsumoImport[]>([]);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [importing, setImporting] = useState(false);
  
  const { importInsumos } = useImportInsumos();

  const handleJsonChange = (value: string) => {
    setJsonInput(value);
    setValidationError(null);
    setPreviewItems([]);
    
    if (!value.trim()) return;

    try {
      const parsed = JSON.parse(value);
      
      if (!parsed.itens || !Array.isArray(parsed.itens)) {
        setValidationError('JSON deve ter um campo "itens" que seja um array');
        return;
      }

      if (parsed.itens.length === 0) {
        setValidationError('Array "itens" não pode estar vazio');
        return;
      }

      // Validar cada item
      const invalidItems = parsed.itens.filter((item: any, index: number) => {
        if (!item.nome || typeof item.nome !== 'string') {
          setValidationError(`Item ${index + 1}: campo "nome" é obrigatório e deve ser texto`);
          return true;
        }
        if (!item.preco_por_kg || typeof item.preco_por_kg !== 'number' || item.preco_por_kg <= 0) {
          setValidationError(`Item ${index + 1}: campo "preco_por_kg" é obrigatório e deve ser número positivo`);
          return true;
        }
        return false;
      });

      if (invalidItems.length > 0) return;

      setPreviewItems(parsed.itens);
    } catch (error) {
      setValidationError('JSON inválido: ' + (error as Error).message);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonInput(content);
      handleJsonChange(content);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (previewItems.length === 0) return;

    setImporting(true);
    try {
      const result = await importInsumos(previewItems);
      setImportResult(result);
      setJsonInput('');
      setPreviewItems([]);
    } catch (error) {
      console.error('Erro na importação:', error);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setJsonInput('');
    setValidationError(null);
    setPreviewItems([]);
    setImportResult(null);
  };

  const exampleJson = {
    "itens": [
      {
        "nome": "Creatina Monohidratada",
        "segmento": "Suplemento Ergogênico",
        "preco_por_kg": 40.00
      },
      {
        "nome": "Vitamina C - Ácido Ascórbico 99%",
        "segmento": "Vitaminas",
        "preco_por_kg": 38.00
      }
    ]
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Importar Lista
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Lista de Matérias-Primas</DialogTitle>
          <DialogDescription>
            Importe múltiplas matérias-primas de uma vez. Duplicatas serão atualizadas automaticamente.
          </DialogDescription>
        </DialogHeader>

        {!importResult ? (
          <div className="space-y-4">
            {/* Instruções */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Formato esperado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Cole um JSON ou faça upload de um arquivo .json no seguinte formato:
                </p>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                  {JSON.stringify(exampleJson, null, 2)}
                </pre>
                <p className="text-xs text-muted-foreground">
                  • <strong>nome</strong>: Nome do insumo (obrigatório)<br />
                  • <strong>preco_por_kg</strong>: Preço em R$ por quilograma (obrigatório)<br />
                  • <strong>segmento</strong>: Categoria do insumo (opcional)
                </p>
              </CardContent>
            </Card>

            {/* Upload de arquivo */}
            <div>
              <Label htmlFor="file-upload" className="mb-2 block">
                Upload de arquivo JSON
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <FileJson className="w-4 h-4 mr-2" />
                  Selecionar arquivo
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Ou</span>
              </div>
            </div>

            {/* Textarea para colar JSON */}
            <div>
              <Label htmlFor="json-input">Cole o JSON aqui</Label>
              <Textarea
                id="json-input"
                value={jsonInput}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder={JSON.stringify(exampleJson, null, 2)}
                className="font-mono text-xs min-h-[200px]"
              />
            </div>

            {/* Erro de validação */}
            {validationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {/* Preview dos itens */}
            {previewItems.length > 0 && !validationError && (
              <Card className="border-green-500">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Preview: {previewItems.length} insumos
                  </CardTitle>
                  <CardDescription>
                    Revise os dados antes de confirmar a importação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {previewItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted rounded-md text-sm"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.nome}</p>
                          {item.segmento && (
                            <p className="text-xs text-muted-foreground">{item.segmento}</p>
                          )}
                        </div>
                        <p className="font-semibold">{formatCurrency(item.preco_por_kg)}/kg</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Botões de ação */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={previewItems.length === 0 || importing}
              >
                {importing ? 'Importando...' : `Confirmar Importação (${previewItems.length})`}
              </Button>
            </div>
          </div>
        ) : (
          // Resultado da importação
          <div className="space-y-4">
            <Card className="border-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Importação Concluída
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {importResult.resumo.criados}
                    </p>
                    <p className="text-sm text-muted-foreground">Criados</p>
                  </div>
                  <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {importResult.resumo.atualizados}
                    </p>
                    <p className="text-sm text-muted-foreground">Atualizados</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">
                      {importResult.resumo.ignorados}
                    </p>
                    <p className="text-sm text-muted-foreground">Ignorados</p>
                  </div>
                </div>

                {importResult.resumo.alertas.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">
                        {importResult.resumo.alertas.length} alerta(s):
                      </p>
                      <ul className="text-xs space-y-1">
                        {importResult.resumo.alertas.slice(0, 5).map((alerta, i) => (
                          <li key={i}>• {alerta}</li>
                        ))}
                        {importResult.resumo.alertas.length > 5 && (
                          <li className="text-muted-foreground">
                            ... e mais {importResult.resumo.alertas.length - 5} alertas
                          </li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Accordion type="single" collapsible>
                  <AccordionItem value="details">
                    <AccordionTrigger>Ver detalhes</AccordionTrigger>
                    <AccordionContent>
                      <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {importResult.resultado.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-2 bg-muted rounded-md text-sm"
                          >
                            {item.acao === 'criado' && (
                              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            )}
                            {item.acao === 'atualizado' && (
                              <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            )}
                            {item.acao === 'erro' && (
                              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.nome_original}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {item.normalized_name}
                              </p>
                              {item.erro && (
                                <p className="text-xs text-red-500">{item.erro}</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {item.acao === 'criado' && (
                                <span className="text-xs text-green-600">Novo</span>
                              )}
                              {item.acao === 'atualizado' && (
                                <span className="text-xs text-blue-600">Atualizado</span>
                              )}
                              {item.acao === 'erro' && (
                                <span className="text-xs text-red-600">Erro</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
