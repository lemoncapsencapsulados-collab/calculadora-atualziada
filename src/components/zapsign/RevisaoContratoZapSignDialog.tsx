import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ZapSignReplacement } from '@/lib/zapsignContrato';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templateId: string;
  ambiente: 'producao' | 'sandbox';
  modeloNome?: string;
  replacements: ZapSignReplacement[];
  sending: boolean;
  onConfirm: () => void;
}

function stripBraces(v: string): string {
  return String(v || '').replace(/[{}\s]/g, '').toUpperCase();
}

export function RevisaoContratoZapSignDialog({
  open, onOpenChange, templateId, ambiente, modeloNome, replacements, sending, onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState<any[] | null>(null);
  const [templateType, setTemplateType] = useState<string>('');
  const [erro, setErro] = useState<string>('');

  const carregar = async () => {
    if (!templateId) return;
    setLoading(true);
    setErro('');
    setInputs(null);
    try {
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/criar-contrato-zapsign`);
      url.searchParams.set('template_id', templateId.trim());
      url.searchParams.set('ambiente', ambiente);
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.valid) {
        setErro(data?.error || data?.hint || 'Não foi possível carregar o modelo.');
        return;
      }
      setTemplateType(String(data?.template?.template_type || '').toUpperCase());
      const list = Array.isArray(data?.template?.inputs) ? data.template.inputs : [];
      setInputs(list);
    } catch (err: any) {
      setErro(err?.message || 'Erro ao carregar campos do modelo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateId, ambiente]);

  // Constrói lookup normalizado (sem chaves, uppercase) -> valor
  const lookup: Record<string, string> = {};
  for (const r of replacements) {
    const k = stripBraces(r.de);
    if (!lookup[k] && r.para != null && String(r.para).trim()) lookup[k] = String(r.para);
  }

  const resolvidos = (inputs || []).map((inp: any) => {
    const rawVar = inp?.variable || inp?.name || inp?.label || '';
    const key = stripBraces(rawVar);
    const valor = lookup[key] || '';
    return {
      variable: rawVar,
      label: inp?.label,
      required: !!inp?.required,
      valor,
      preenchido: !!valor.trim(),
    };
  });

  const faltantesObrig = resolvidos.filter((r) => r.required && !r.preenchido);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisar envio — {modeloNome || 'Contrato ZapSign'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Estes são exatamente os valores que serão enviados para cada variável do modelo na ZapSign.
            Confira antes de confirmar. Se algo estiver errado, volte e edite os campos.
          </p>

          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando campos do modelo...
            </div>
          )}

          {erro && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {erro}
            </div>
          )}

          {!loading && !erro && inputs && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">Tipo: {templateType || '—'}</Badge>
                <Badge variant="secondary">{inputs.length} variáveis</Badge>
                {faltantesObrig.length > 0 ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" /> {faltantesObrig.length} obrigatório(s) vazio(s)
                  </Badge>
                ) : (
                  <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> Todos os obrigatórios preenchidos
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={carregar} disabled={loading}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Recarregar
                </Button>
              </div>

              {inputs.length === 0 ? (
                <div className="text-sm text-muted-foreground italic border rounded-md p-3">
                  O modelo não expõe variáveis dinâmicas.
                </div>
              ) : (
                <div className="border rounded-md divide-y">
                  {resolvidos.map((r, i) => (
                    <div key={i} className="p-2.5 grid grid-cols-1 md:grid-cols-[minmax(0,240px)_1fr_auto] gap-2 md:gap-3 items-start text-sm">
                      <div className="min-w-0">
                        <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded break-all">
                          {`{{${r.variable}}}`}
                        </code>
                      </div>
                      <div className={`min-w-0 whitespace-pre-wrap break-words ${r.preenchido ? '' : 'text-muted-foreground italic'}`}>
                        {r.preenchido ? r.valor : '— (vazio)'}
                      </div>
                      <div className="flex items-center gap-1">
                        {r.required && !r.preenchido && (
                          <Badge variant="destructive" className="text-[10px]">obrigatório</Badge>
                        )}
                        {r.required && r.preenchido && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700">ok</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {faltantesObrig.length > 0 && (
                <div className="rounded-md border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <strong>Atenção:</strong> {faltantesObrig.length} variável(is) obrigatória(s) sem valor.
                  A ZapSign pode recusar o envio. Volte e preencha antes de confirmar.
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Voltar e editar
          </Button>
          <Button onClick={onConfirm} disabled={sending || loading || !!erro}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {sending ? 'Enviando...' : 'Confirmar e enviar para ZapSign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}