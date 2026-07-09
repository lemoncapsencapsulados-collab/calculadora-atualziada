import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ZAPSIGN_ALIAS_GROUPS, type ZapSignReplacement } from '@/lib/zapsignContrato';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templateId: string;
  ambiente: 'producao' | 'sandbox';
  modeloNome?: string;
  replacements: ZapSignReplacement[];
  sending: boolean;
  onConfirm: (finalReplacements: ZapSignReplacement[]) => void;
  inline?: boolean;
}

function stripBraces(v: string): string {
  return String(v || '').replace(/[{}\s]/g, '').toUpperCase();
}

function withBraces(v: string): string {
  const clean = String(v || '').trim();
  if (!clean) return '';
  return clean.startsWith('{{') ? clean : `{{${clean}}}`;
}

function aliasKeysFor(variable: string): string[] {
  const normalized = stripBraces(variable);
  const group = ZAPSIGN_ALIAS_GROUPS.find((items) => items.some((item) => stripBraces(item) === normalized));
  return group ? group.map(stripBraces) : [normalized];
}

function getInputVariable(inp: any): string {
  if (typeof inp === 'string') return inp;
  return inp?.variable || inp?.name || inp?.label || '';
}

export function RevisaoContratoZapSignDialog({
  open, onOpenChange, templateId, ambiente, modeloNome, replacements, sending, onConfirm, inline = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState<any[] | null>(null);
  const [templateType, setTemplateType] = useState<string>('');
  const [erro, setErro] = useState<string>('');
  const [valoresEditados, setValoresEditados] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!open || !inputs) return;
    const next: Record<string, string> = {};
    for (const inp of inputs) {
      const rawVar = getInputVariable(inp);
      const key = stripBraces(rawVar);
      next[key] = lookup[key] || '';
    }
    setValoresEditados(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inputs, replacements]);

  const resolvidos = (inputs || []).map((inp: any) => {
    const rawVar = getInputVariable(inp);
    const key = stripBraces(rawVar);
    const valor = valoresEditados[key] ?? lookup[key] ?? '';
    return {
      variable: rawVar,
      key,
      label: typeof inp === 'string' ? '' : inp?.label,
      required: typeof inp === 'string' ? false : !!inp?.required,
      valor,
      preenchido: !!valor.trim(),
    };
  });

  const faltantesObrig = resolvidos.filter((r) => r.required && !r.preenchido);

  const montarReplacementsFinais = (): ZapSignReplacement[] => {
    const finalData = replacements.map((r) => ({ ...r }));
    const existentes = new Set(finalData.map((item) => stripBraces(item.de)));

    for (const r of resolvidos) {
      const value = valoresEditados[r.key] ?? '';
      const aliasKeys = aliasKeysFor(r.variable);
      let updatedAny = false;
      finalData.forEach((item) => {
        if (aliasKeys.includes(stripBraces(item.de))) {
          item.para = value;
          updatedAny = true;
        }
      });
      if (!updatedAny && r.variable) {
        finalData.push({ de: withBraces(r.variable), para: value });
        existentes.add(stripBraces(r.variable));
      }
      for (const aliasGroupKey of aliasKeys) {
        if (!existentes.has(aliasGroupKey)) {
          const alias = ZAPSIGN_ALIAS_GROUPS.flat().find((item) => stripBraces(item) === aliasGroupKey);
          if (alias) {
            finalData.push({ de: alias, para: value });
            existentes.add(aliasGroupKey);
          }
        }
      }
    }

    return finalData;
  };

  const content = (
    <>
        <DialogHeader>
          <DialogTitle>Revisar envio — {modeloNome || 'Contrato ZapSign'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Estes são os campos reais do modelo na ZapSign. Eles já vêm preenchidos com os dados finais,
            mas você pode editar qualquer valor aqui antes de confirmar o envio.
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
                          {withBraces(r.variable)}
                        </code>
                        {r.label && r.label !== r.variable && (
                          <p className="mt-1 text-[11px] text-muted-foreground break-words">{r.label}</p>
                        )}
                      </div>
                      <Textarea
                        value={r.valor}
                        onChange={(e) => setValoresEditados((prev) => ({ ...prev, [r.key]: e.target.value }))}
                        rows={String(r.valor || '').length > 80 ? 3 : 1}
                        className="min-h-9 resize-y text-sm"
                        placeholder="Valor que será enviado"
                      />
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
          <Button
            onClick={() => onConfirm(montarReplacementsFinais())}
            disabled={sending || loading || !!erro || faltantesObrig.length > 0}
            title={faltantesObrig.length > 0 ? `Preencha os ${faltantesObrig.length} campo(s) obrigatório(s) antes de enviar` : undefined}
          >
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {sending
              ? 'Enviando...'
              : faltantesObrig.length > 0
                ? `Preencha ${faltantesObrig.length} obrigatório(s)`
                : 'Confirmar e enviar para ZapSign'}
          </Button>
        </DialogFooter>
    </>
  );

  if (inline) return content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {content}
      </DialogContent>
    </Dialog>
  );
}