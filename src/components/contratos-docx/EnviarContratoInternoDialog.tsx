import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Send, FileText, AlertTriangle, Mail, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useContratoModelosDocx, detectarVariaveis, baixarModeloArquivo } from '@/hooks/useContratoModelosDocx';
import { docxParaHtml, preencherDocxOriginal } from '@/lib/docxEditor';
import { preencherHtmlComVariaveis } from '@/lib/docxEditor';
import { construirMapaAutoFill, preencherAutomatico } from '@/lib/contratoDocxAutoFill';
import type { ZapSignContratoCampos } from '@/lib/zapsignContrato';
import { supabase } from '@/integrations/supabase/client';
import { saveAs } from 'file-saver';
import { fetchEnderecoPorCEP } from '@/lib/brasilData';
import CondicoesPagamentoForm from '@/components/CondicoesPagamentoForm';
import { formatarCondicoesParaContrato } from '@/lib/formatarPagamento';
import type { CondicoesPagamento } from '@/types/orcamento';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campos: ZapSignContratoCampos | null;
  contexto?: {
    consultorNome?: string;
    orcamentoId?: string | null;
    orcamentoNumero?: string | null;
    pedidoId?: string | null;
    cliente?: string;
  };
  condicoesPagamento?: CondicoesPagamento;
  valorTotalNumerico?: number;
  entregaveisPadrao?: string[];
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

// ---- Formatadores ----------------------------------------------------------
const PALAVRAS_MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du']);

function capitalizarNome(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .split(/(\s+)/)
    .map((tok, i) => {
      if (/^\s+$/.test(tok)) return tok;
      if (i > 0 && PALAVRAS_MINUSCULAS.has(tok)) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join('');
}

function formatarCEP(input: string): string {
  const n = (input || '').replace(/\D/g, '').slice(0, 8);
  if (n.length <= 5) return n;
  return `${n.slice(0, 5)}-${n.slice(5)}`;
}

function formatarTelefone(input: string): string {
  const n = (input || '').replace(/\D/g, '').slice(0, 11);
  if (n.length < 3) return n;
  const ddd = `(${n.slice(0, 2)})`;
  const resto = n.slice(2);
  if (!resto) return ddd;
  if (resto.length <= 4) return `${ddd} ${resto}`;
  if (resto.length <= 8) return `${ddd} ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `${ddd} ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

function tipoVariavel(v: string): 'nome' | 'cep' | 'telefone' | 'endereco' | 'pagamento' | 'outro' {
  const k = v.toUpperCase();
  if (/CONDICAO_?PAGAMENTO|CONDIÇÃO_?PAGAMENTO|PAGAMENTO/.test(k)) return 'pagamento';
  if (/ENTREGAV/.test(k)) return 'entregaveis' as any;
  if (/TELEFONE|CELULAR|WHATSAPP|PHONE/.test(k)) return 'telefone';
  if (/\bCEP\b/.test(k)) return 'cep';
  if (/ENDERECO|ENDEREÇO|LOGRADOURO/.test(k)) return 'endereco';
  if (/NOME|RAZAO|RAZÃO|REPRESENTANTE|CONTRATANTE/.test(k) && !/CNPJ|CPF|EMAIL|E-MAIL/.test(k)) return 'nome';
  return 'outro';
}

function formatarValor(v: string, valor: string): string {
  const t = tipoVariavel(v);
  if (t === 'cep') return formatarCEP(valor);
  if (t === 'telefone') return formatarTelefone(valor);
  if (t === 'nome') return capitalizarNome(valor);
  return valor;
}

function entregaveisParaTexto(items: string[]): string {
  return items.map((s) => limparEmojis(s).trim()).filter(Boolean).map((s) => `• ${s}`).join('\n');
}

function limparEmojis(s: string): string {
  // Remove emojis (símbolos pictográficos, dingbats, checkmarks) e espaços duplicados
  return s
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function EnviarContratoInternoDialog({ open, onOpenChange, campos, contexto, condicoesPagamento, valorTotalNumerico, entregaveisPadrao }: Props) {
  const { data: modelos = [], isLoading } = useContratoModelosDocx();
  const [modeloId, setModeloId] = useState<string>('');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [nomeArquivo, setNomeArquivo] = useState('Contrato');
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [htmlBase, setHtmlBase] = useState<string>('');
  const [carregandoHtml, setCarregandoHtml] = useState(false);
  const [complemento, setComplemento] = useState('');
  const [cepStatus, setCepStatus] = useState<Record<string, 'ok' | 'invalido' | 'checando' | undefined>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [condEdit, setCondEdit] = useState<CondicoesPagamento>({});
  const [entregaveisEdit, setEntregaveisEdit] = useState<string[]>([]);

  // Sincroniza entregáveis ao abrir
  useEffect(() => {
    if (open) setEntregaveisEdit((entregaveisPadrao && entregaveisPadrao.length) ? [...entregaveisPadrao] : []);
  }, [open, entregaveisPadrao?.join('|')]);

  // Atualiza texto formatado em todas as variáveis de entregáveis quando a lista muda
  useEffect(() => {
    const texto = entregaveisParaTexto(entregaveisEdit);
    setValores((prev) => {
      const next = { ...prev };
      let mudou = false;
      for (const v of Object.keys(next)) {
        if ((tipoVariavel(v) as any) === 'entregaveis' && next[v] !== texto) {
          next[v] = texto;
          mudou = true;
        }
      }
      return mudou ? next : prev;
    });
  }, [entregaveisEdit]);

  // Sincroniza estrutura de condições ao abrir
  useEffect(() => {
    if (open) setCondEdit(condicoesPagamento ? { ...condicoesPagamento } : {});
  }, [open, condicoesPagamento]);

  // Sempre que a estrutura mudar, atualiza o texto formatado em TODAS as vars de pagamento
  useEffect(() => {
    const texto = formatarCondicoesParaContrato(condEdit, valorTotalNumerico);
    if (!texto) return;
    setValores((prev) => {
      const next = { ...prev };
      let mudou = false;
      for (const v of Object.keys(next)) {
        if (tipoVariavel(v) === 'pagamento' && next[v] !== texto) {
          next[v] = texto;
          mudou = true;
        }
      }
      return mudou ? next : prev;
    });
  }, [condEdit, valorTotalNumerico]);

  const modelo = useMemo(() => modelos.find((m) => m.id === modeloId) || null, [modelos, modeloId]);
  const variaveis = useMemo(() => detectarVariaveis(htmlBase || ''), [htmlBase]);
  const mapaAuto = useMemo(() => (campos ? construirMapaAutoFill(campos) : {}), [campos]);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      const padrao = modelos.find((m) => !!m.html_editado) || modelos[0];
      setModeloId((prev) => prev || padrao?.id || '');
      setNomeArquivo(`Contrato-${contexto?.orcamentoNumero || contexto?.cliente || 'gerado'}`.replace(/[^\w\-]+/g, '_'));
    }
  }, [open, modelos.length]);

  // Carrega HTML do modelo selecionado (editado ou converte do arquivo)
  useEffect(() => {
    if (!open || !modelo) { setHtmlBase(''); return; }
    if (modelo.html_editado) {
      setHtmlBase(modelo.html_editado);
      return;
    }
    let cancel = false;
    setCarregandoHtml(true);
    setHtmlBase('');
    (async () => {
      try {
        const buf = await baixarModeloArquivo(modelo.arquivo_url);
        const html = await docxParaHtml(buf);
        if (!cancel) setHtmlBase(html);
      } catch (e: any) {
        if (!cancel) toast.error('Falha ao carregar modelo: ' + (e?.message || 'erro'));
      } finally {
        if (!cancel) setCarregandoHtml(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, modelo?.id]);

  // Auto-preenche variáveis a partir dos campos do orçamento sempre que muda modelo/variáveis
  useEffect(() => {
    if (!variaveis.length) { setValores({}); return; }
    setValores((prev) => {
      const next: Record<string, string> = {};
      for (const v of variaveis) {
        if ((tipoVariavel(v) as any) === 'entregaveis') {
          next[v] = prev[v] ?? entregaveisParaTexto(entregaveisEdit);
          continue;
        }
        const bruto = prev[v] ?? preencherAutomatico(v, mapaAuto);
        next[v] = formatarValor(v, bruto);
      }
      return next;
    });
  }, [variaveis.join('|'), mapaAuto]);

  // Aplica complemento nas variáveis de endereço (sem duplicar)
  const aplicarComplementoEmEnderecos = (base: Record<string, string>): Record<string, string> => {
    const compTrim = complemento.trim();
    const out = { ...base };
    for (const v of variaveis) {
      if (tipoVariavel(v) !== 'endereco') continue;
      const raw = (out[v] || '').replace(/\s*-\s*Compl\.:.*$/i, '').trim();
      out[v] = compTrim ? `${raw} - Compl.: ${compTrim}` : raw;
    }
    return out;
  };

  const validarCEPsAntesEnvio = async (): Promise<boolean> => {
    const cepVars = variaveis.filter((v) => tipoVariavel(v) === 'cep');
    for (const v of cepVars) {
      const val = (valores[v] || '').replace(/\D/g, '');
      if (!val) continue;
      if (val.length !== 8) {
        toast.error(`CEP inválido em ${v}`);
        setCepStatus((s) => ({ ...s, [v]: 'invalido' }));
        return false;
      }
      setCepStatus((s) => ({ ...s, [v]: 'checando' }));
      const r = await fetchEnderecoPorCEP(val);
      if (!r) {
        toast.error(`CEP não encontrado (${valores[v]}) em ${v}`);
        setCepStatus((s) => ({ ...s, [v]: 'invalido' }));
        return false;
      }
      setCepStatus((s) => ({ ...s, [v]: 'ok' }));
    }
    return true;
  };

  // Gera o DOCX preenchendo APENAS as variáveis {{...}} no arquivo Word ORIGINAL
  // (via docxtemplater), preservando 100% da formatação: fontes, tamanhos,
  // alinhamentos, cabeçalhos, tabelas — idêntico ao modelo enviado.
  const gerarBlob = async (): Promise<Blob | null> => {
    if (!modelo) {
      toast.error('Selecione um modelo.');
      return null;
    }
    try {
      const buf = await baixarModeloArquivo(modelo.arquivo_url);
      const finais = aplicarComplementoEmEnderecos(valores);
      return preencherDocxOriginal(buf, finais);
    } catch (e: any) {
      toast.error('Erro ao preencher modelo: ' + (e?.message || 'erro'));
      return null;
    }
  };

  const handleGerar = async () => {
    setGerando(true);
    try {
      const ok = await validarCEPsAntesEnvio();
      if (!ok) return;
      const blob = await gerarBlob();
      if (!blob) return;
      saveAs(blob, nomeArquivo.endsWith('.docx') ? nomeArquivo : `${nomeArquivo}.docx`);
      toast.success('Contrato gerado! Verifique a pasta de downloads.');
    } catch (e: any) {
      toast.error('Erro ao gerar: ' + (e?.message || 'erro'));
    } finally {
      setGerando(false);
    }
  };

  const handleEnviarFinanceiro = async () => {
    if (!modelo?.email_financeiro?.trim()) {
      toast.error('Este modelo não possui email do financeiro configurado. Vá ao Editor de Contratos para configurar.');
      return;
    }
    setEnviando(true);
    try {
      const ok = await validarCEPsAntesEnvio();
      if (!ok) return;
      const blob = await gerarBlob();
      if (!blob) return;
      const base64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke('enviar-contrato-docx', {
        body: {
          docxBase64: base64,
          filename: `${nomeArquivo}.docx`,
          emailFinanceiro: modelo.email_financeiro,
          nomeFinanceiro: modelo.nome_financeiro || '',
          modeloNome: modelo.nome,
          consultorNome: contexto?.consultorNome || '',
          razaoSocial: campos?.razao_social || '',
          cnpj: campos?.cnpj || '',
          cliente: contexto?.cliente || campos?.razao_social || '',
          valorTotal: campos?.valor_total || '',
          orcamentoId: contexto?.orcamentoId ?? null,
          orcamentoNumero: contexto?.orcamentoNumero ?? null,
          pedidoId: contexto?.pedidoId ?? null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Contrato enviado para ${modelo.email_financeiro}`);
      supabase.functions.invoke('emit-webhook-event', {
        body: {
          evento: 'contrato.enviado',
          payload: {
            modelo: modelo.nome,
            emailFinanceiro: modelo.email_financeiro,
            cliente: contexto?.cliente || campos?.razao_social || '',
            cnpj: campos?.cnpj || '',
            orcamentoId: contexto?.orcamentoId ?? null,
            orcamentoNumero: contexto?.orcamentoNumero ?? null,
            pedidoId: contexto?.pedidoId ?? null,
          },
        },
      }).catch(() => {});
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Falha ao enviar: ' + (e?.message || 'erro'));
    } finally {
      setEnviando(false);
    }
  };

  const semModelos = !isLoading && modelos.length === 0;
  const semEmailFin = modelo && !modelo.email_financeiro?.trim();

  const temEndereco = variaveis.some((v) => tipoVariavel(v) === 'endereco');

  const htmlPreview = useMemo(() => {
    if (!htmlBase) return '';
    const finais = aplicarComplementoEmEnderecos(valores);
    return preencherHtmlComVariaveis(htmlBase, finais);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlBase, valores, complemento]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Enviar Contrato
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Modelo de contrato <span className="text-destructive">*</span></Label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando modelos...
              </div>
            ) : semModelos ? (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  Nenhum modelo cadastrado. Vá em <strong>Editor de Contratos</strong> para enviar um modelo DOCX.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={modeloId} onValueChange={setModeloId}>
                <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
                <SelectContent>
                  {modelos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                      {m.email_financeiro ? ` — envia p/ ${m.email_financeiro}` : ' (sem email configurado)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {semEmailFin && (
            <Alert>
              <Mail className="w-4 h-4" />
              <AlertDescription>
                Este modelo não tem <strong>email do financeiro</strong> configurado. Você pode gerar o contrato, mas não enviar. Configure em <strong>Editor de Contratos</strong>.
              </AlertDescription>
            </Alert>
          )}

          {carregandoHtml && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando modelo...
            </div>
          )}

          <div className="space-y-1">
            <Label>Nome do arquivo</Label>
            <Input value={nomeArquivo} onChange={(e) => setNomeArquivo(e.target.value)} />
          </div>

          {temEndereco && (
            <div className="space-y-1">
              <Label>Complemento do endereço <span className="text-xs text-muted-foreground">(opcional — aplicado a todos os endereços)</span></Label>
              <Input
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                placeholder="Ex.: Sala 302 · Bloco B · Ap 41"
              />
            </div>
          )}

          {!carregandoHtml && modelo && variaveis.length === 0 && htmlBase && (
            <Alert>
              <AlertDescription>
                Nenhuma variável <code>{'{{...}}'}</code> encontrada no modelo. O contrato será gerado como está.
              </AlertDescription>
            </Alert>
          )}

          {variaveis.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{variaveis.length} variáveis</Badge>
                <span className="text-xs text-muted-foreground">Pré-preenchidas com os dados do orçamento. Ajuste se necessário.</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {variaveis.map((v) => {
                  const autoValue = preencherAutomatico(v, mapaAuto);
                  const filled = !!valores[v]?.trim();
                  const t = tipoVariavel(v);
                  const status = cepStatus[v];
                  if (t === 'pagamento') {
                    const preview = formatarCondicoesParaContrato(condEdit, valorTotalNumerico) || valores[v] || '';
                    return (
                      <div key={v} className="space-y-2 md:col-span-2 border rounded-md p-3 bg-muted/20">
                        <Label className="text-xs font-mono flex items-center gap-1">
                          {`{{${v}}}`}
                          <Badge variant="outline" className="text-[10px]">editor de pagamento</Badge>
                        </Label>
                        <CondicoesPagamentoForm
                          value={condEdit}
                          onChange={setCondEdit}
                          valorTotal={valorTotalNumerico || 0}
                        />
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Texto que será inserido no contrato</Label>
                          <div className="text-sm bg-background border rounded-md p-2 whitespace-pre-wrap">
                            {preview || <span className="text-muted-foreground">Configure as parcelas acima.</span>}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if ((t as any) === 'entregaveis') {
                    const preview = entregaveisParaTexto(entregaveisEdit);
                    return (
                      <div key={v} className="space-y-2 md:col-span-2 border rounded-md p-3 bg-muted/20">
                        <Label className="text-xs font-mono flex items-center gap-1">
                          {`{{${v}}}`}
                          <Badge variant="outline" className="text-[10px]">entregáveis do projeto</Badge>
                          <Badge variant="secondary" className="text-[10px] ml-auto">{entregaveisEdit.length} itens</Badge>
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Puxado do projeto. Edite, adicione ou remova itens — vão para a Cláusula 1 do contrato.
                        </p>
                        <div className="space-y-2">
                          {entregaveisEdit.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="pt-2 text-muted-foreground">•</span>
                              <Textarea
                                rows={1}
                                value={item}
                                onChange={(e) => {
                                  const next = [...entregaveisEdit];
                                  next[idx] = e.target.value;
                                  setEntregaveisEdit(next);
                                }}
                                className="text-xs flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setEntregaveisEdit(entregaveisEdit.filter((_, i) => i !== idx))}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEntregaveisEdit([...entregaveisEdit, ''])}
                          >
                            <Plus className="w-4 h-4 mr-1" /> Adicionar entregável
                          </Button>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Texto que será inserido no contrato</Label>
                          <div className="text-sm bg-background border rounded-md p-2 whitespace-pre-wrap">
                            {preview || <span className="text-muted-foreground">Nenhum entregável.</span>}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={v} className="space-y-1">
                      <Label className="text-xs font-mono flex items-center gap-1">
                        {`{{${v}}}`}
                        {autoValue && <Badge variant="outline" className="text-[10px]">auto</Badge>}
                        {!filled && <Badge variant="destructive" className="text-[10px]">vazio</Badge>}
                        {t === 'cep' && status === 'ok' && <Badge className="text-[10px] bg-emerald-600">CEP ok</Badge>}
                        {t === 'cep' && status === 'invalido' && <Badge variant="destructive" className="text-[10px]">CEP inválido</Badge>}
                      </Label>
                      <Textarea
                        rows={2}
                        value={valores[v] || ''}
                        onChange={(e) => setValores({ ...valores, [v]: formatarValor(v, e.target.value) })}
                        onBlur={async () => {
                          if (t !== 'cep') return;
                          const nums = (valores[v] || '').replace(/\D/g, '');
                          if (nums.length !== 8) { setCepStatus((s) => ({ ...s, [v]: 'invalido' })); return; }
                          setCepStatus((s) => ({ ...s, [v]: 'checando' }));
                          const r = await fetchEnderecoPorCEP(nums);
                          setCepStatus((s) => ({ ...s, [v]: r ? 'ok' : 'invalido' }));
                        }}
                        placeholder={autoValue || 'Valor a preencher'}
                        className="text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={gerando || enviando}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!htmlBase}>
            <FileText className="w-4 h-4 mr-2" /> Ver preview
          </Button>
          <Button variant="secondary" onClick={handleGerar} disabled={gerando || enviando || !modelo || !htmlBase}>
            {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Gerar contrato
          </Button>
          <Button onClick={handleEnviarFinanceiro} disabled={gerando || enviando || !modelo || !htmlBase || !modelo?.email_financeiro?.trim()}>
            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar para financeiro
          </Button>
        </DialogFooter>
      </DialogContent>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> Preview do contrato
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto bg-muted/30 px-4 pb-6" style={{ maxHeight: '80vh' }}>
            <div
              className="contrato-editor"
              style={{ background: 'white' }}
              dangerouslySetInnerHTML={{ __html: htmlPreview || '<p>Sem conteúdo</p>' }}
            />
          </div>
          <DialogFooter className="px-6 pb-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button onClick={handleGerar} disabled={gerando}>
              {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Baixar DOCX
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}