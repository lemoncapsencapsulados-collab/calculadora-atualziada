import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, RotateCcw, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useContratoModelos } from '@/hooks/useContratoModelos';
import { valorPorExtensoBRL, formatBRL, dataPorExtenso } from '@/lib/extenso';
import { Pedido } from '@/types/formula';
import { AdminPasswordDialog } from '@/components/admin/AdminPasswordDialog';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pedido: Pedido | null;
}

type ExtraSigner = { name: string; email: string; phone_number: string };

function buildCandidatosExtras(pedido: Pedido | null): ExtraSigner[] {
  const snap: any = pedido?.orcamento_snapshot || {};
  const dc: any = snap.dados_cliente || {};
  const out: ExtraSigner[] = [];
  const push = (nome?: string, email?: string, tel?: string) => {
    if (!nome && !email) return;
    out.push({
      name: nome || '',
      email: email || '',
      phone_number: (tel || '').replace(/\D/g, ''),
    });
  };
  // Representante PJ
  const repPJ = dc.responsavel_pj || {};
  push(repPJ.nome, repPJ.email, repPJ.telefone);
  // Pessoas físicas (sócios/representantes)
  if (Array.isArray(dc.pessoas_fisicas)) {
    for (const pf of dc.pessoas_fisicas) push(pf?.nome, pf?.email, pf?.telefone);
  }
  // Contato geral do cliente
  push(dc.razao_social || snap.nome_cliente, dc.email, dc.telefone);
  // Remove duplicatas por email
  const seen = new Set<string>();
  return out.filter((s) => {
    const key = (s.email || s.name).toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type Campos = {
  signer_name: string;
  signer_email: string;
  signer_phone_number: string;
  razao_social: string;
  cnpj: string;
  endereco: string;
  email_contratante: string;
  telefone_contratante: string;
  nome_representante: string;
  cpf_representante: string;
  numero_contrato: string;
  data_contrato: string;
  produto_descricao: string;
  produto_apresentacao: string;
  produto_preco_unit: string;
  produto_quantidade: string;
  valor_setup: string;
  valor_setup_extenso: string;
  valor_producao: string;
  valor_producao_extenso: string;
  valor_total: string;
  valor_total_extenso: string;
};

function buildCampos(pedido: Pedido | null): Campos {
  const snap: any = pedido?.orcamento_snapshot || {};
  const dc: any = snap.dados_cliente || {};
  const isPJ = !!(dc.cnpj || dc.razao_social);
  const repPJ = (dc.responsavel_pj) || {};
  const repPF = (dc.pessoas_fisicas && dc.pessoas_fisicas[0]) || {};
  const rep: any = isPJ ? repPJ : repPF;
  const signerName = rep.nome || dc.razao_social || snap.nome_cliente || '';
  const signerEmail = rep.email || dc.email || '';
  const signerPhone = (rep.telefone || dc.telefone || '').replace(/\D/g, '');
  const razao = isPJ ? (dc.razao_social || '') : (rep.nome || '');
  const cnpj = isPJ ? (dc.cnpj || '') : (rep.cpf || '');
  const endereco = isPJ
    ? [dc.endereco_cnpj, dc.cidade, dc.estado, dc.cep_cnpj].filter(Boolean).join(' - ')
    : [rep.endereco, rep.cidade, rep.estado, rep.cep].filter(Boolean).join(' - ');
  const item = snap.itens_producao?.[0];
  const valorSetup = snap.subtotal_servicos || 0;
  const valorProd = snap.subtotal_producao || 0;
  const valorTotal = snap.valor_total || 0;
  return {
    signer_name: signerName,
    signer_email: signerEmail,
    signer_phone_number: signerPhone,
    razao_social: razao,
    cnpj,
    endereco,
    email_contratante: dc.email || signerEmail,
    telefone_contratante: dc.telefone || signerPhone,
    nome_representante: rep.nome || '',
    cpf_representante: rep.cpf || '',
    numero_contrato: pedido?.numero_pedido || snap.numero_orcamento || '',
    data_contrato: dataPorExtenso(new Date()),
    produto_descricao: item ? `${item.nome_produto}${item.segmento ? ` (${item.segmento})` : ''}` : '',
    produto_apresentacao: item?.quantidade_por_pote ? `${item.quantidade_por_pote} ${item.unidade_por_pote || ''} por frasco`.trim() : '',
    produto_preco_unit: item ? formatBRL(item.preco_unitario) : '',
    produto_quantidade: item ? String(item.quantidade) : '',
    valor_setup: formatBRL(valorSetup),
    valor_setup_extenso: valorPorExtensoBRL(valorSetup),
    valor_producao: formatBRL(valorProd),
    valor_producao_extenso: valorPorExtensoBRL(valorProd),
    valor_total: formatBRL(valorTotal),
    valor_total_extenso: valorPorExtensoBRL(valorTotal),
  };
}

export function EnviarContratoZapSignPedidoDialog({ open, onOpenChange, pedido }: Props) {
  const { data: modelos = [] } = useContratoModelos();
  const [modeloId, setModeloId] = useState<string>('');
  const [campos, setCampos] = useState<Campos>(() => buildCampos(pedido));
  const [loading, setLoading] = useState(false);
  const [askSenhaOpen, setAskSenhaOpen] = useState(false);
  const [extraSigners, setExtraSigners] = useState<ExtraSigner[]>([]);

  const candidatosExtras = useMemo(() => buildCandidatosExtras(pedido), [pedido?.id]);

  useEffect(() => {
    if (open) {
      setCampos(buildCampos(pedido));
      setExtraSigners([]);
    }
  }, [open, pedido?.id]);

  const adicionarSignatario = () => {
    setExtraSigners((prev) => {
      // Próximo candidato que ainda não foi usado (nem como principal)
      const usados = new Set<string>();
      const k = (s: { name?: string; email?: string }) => (s.email || s.name || '').toLowerCase().trim();
      usados.add(k({ name: campos.signer_name, email: campos.signer_email }));
      prev.forEach((s) => usados.add(k(s)));
      const candidato = candidatosExtras.find((c) => {
        const key = k(c);
        return key && !usados.has(key);
      });
      return [...prev, candidato || { name: '', email: '', phone_number: '' }];
    });
  };

  useEffect(() => {
    if (open && !modeloId && modelos.length > 0) {
      const padrao = modelos.find((m) => m.is_padrao);
      setModeloId((padrao || modelos[0]).id);
    }
  }, [open, modelos, modeloId]);

  const upd = (k: keyof Campos, v: string) => setCampos((p) => ({ ...p, [k]: v }));

  const fields: Array<{ k: keyof Campos; label: string; full?: boolean }> = useMemo(() => ([
    { k: 'signer_name', label: 'Nome do signatário' },
    { k: 'signer_email', label: 'Email do signatário' },
    { k: 'signer_phone_number', label: 'Telefone (com DDD)' },
    { k: 'razao_social', label: 'Razão social / Nome' },
    { k: 'cnpj', label: 'CNPJ / CPF' },
    { k: 'endereco', label: 'Endereço', full: true },
    { k: 'email_contratante', label: 'Email do contratante' },
    { k: 'telefone_contratante', label: 'Telefone do contratante' },
    { k: 'nome_representante', label: 'Nome do representante' },
    { k: 'cpf_representante', label: 'CPF do representante' },
    { k: 'numero_contrato', label: 'Número do contrato' },
    { k: 'data_contrato', label: 'Data do contrato' },
    { k: 'produto_descricao', label: 'Produto', full: true },
    { k: 'produto_apresentacao', label: 'Apresentação' },
    { k: 'produto_preco_unit', label: 'Preço unitário' },
    { k: 'produto_quantidade', label: 'Quantidade' },
    { k: 'valor_setup', label: 'Valor setup' },
    { k: 'valor_producao', label: 'Valor produção' },
    { k: 'valor_total', label: 'Valor total' },
  ]), []);

  const handleSubmit = () => {
    const modelo = modelos.find((m) => m.id === modeloId);
    if (!modelo) { toast.error('Selecione um modelo de contrato.'); return; }
    if (!campos.signer_name || !campos.signer_email) {
      toast.error('Preencha nome e email do signatário.');
      return;
    }
    for (const s of extraSigners) {
      if (!s.name?.trim() || !s.email?.trim()) {
        toast.error('Preencha nome e email de todos os signatários adicionais.');
        return;
      }
    }
    if (!pedido) return;
    setAskSenhaOpen(true);
  };

  const enviar = async () => {
    const modelo = modelos.find((m) => m.id === modeloId);
    if (!modelo || !pedido) return;
    setLoading(true);
    try {
      // Tenta obter cliente_id do orçamento, se houver
      let cliente_id: string | null = null;
      if (pedido.orcamento_id) {
        const { data: orc } = await supabase
          .from('orcamentos')
          .select('cliente_id')
          .eq('id', pedido.orcamento_id)
          .maybeSingle();
        cliente_id = (orc as any)?.cliente_id ?? null;
      }

      const data = [
        { de: '{{RAZAO_SOCIAL_CONTRATANTE}}', para: campos.razao_social },
        { de: '{{CNPJ_CONTRATANTE}}', para: campos.cnpj },
        { de: '{{ENDERECO_CONTRATANTE}}', para: campos.endereco },
        { de: '{{EMAIL_CONTRATANTE}}', para: campos.email_contratante },
        { de: '{{TELEFONE_CONTRATANTE}}', para: campos.telefone_contratante },
        { de: '{{NOME_REPRESENTANTE}}', para: campos.nome_representante },
        { de: '{{CPF_REPRESENTANTE}}', para: campos.cpf_representante },
        { de: '{{NUMERO_CONTRATO}}', para: campos.numero_contrato },
        { de: '{{DATA_CONTRATO}}', para: campos.data_contrato },
        { de: '{{PRODUTO_DESCRICAO}}', para: campos.produto_descricao },
        { de: '{{PRODUTO_APRESENTACAO}}', para: campos.produto_apresentacao },
        { de: '{{PRODUTO_PRECO_UNIT}}', para: campos.produto_preco_unit },
        { de: '{{PRODUTO_QUANTIDADE}}', para: campos.produto_quantidade },
        { de: '{{VALOR_SETUP}}', para: campos.valor_setup },
        { de: '{{VALOR_SETUP_EXTENSO}}', para: campos.valor_setup_extenso },
        { de: '{{VALOR_PRODUCAO}}', para: campos.valor_producao },
        { de: '{{VALOR_PRODUCAO_EXTENSO}}', para: campos.valor_producao_extenso },
        { de: '{{VALOR_TOTAL_PROJETO}}', para: campos.valor_total },
        { de: '{{VALOR_TOTAL_PROJETO_EXTENSO}}', para: campos.valor_total_extenso },
      ];

      const { data: resp, error } = await supabase.functions.invoke('criar-contrato-zapsign', {
        body: {
          signer_name: campos.signer_name,
          signer_email: campos.signer_email,
          signer_phone_country: '55',
          signer_phone_number: (campos.signer_phone_number || '').replace(/\D/g, ''),
          lang: 'pt-br',
          send_automatic_email: true,
          data,
          template_id: modelo.template_id,
          ambiente: modelo.ambiente,
          pedido_id: pedido.id,
          orcamento_id: pedido.orcamento_id ?? null,
          cliente_id,
          extra_signers: extraSigners
            .filter((s) => s.name?.trim() && s.email?.trim())
            .map((s) => ({
              name: s.name.trim(),
              email: s.email.trim(),
              phone_country: '55',
              phone_number: (s.phone_number || '').replace(/\D/g, ''),
            })),
        },
      });

      if (error) {
        toast.error(`Erro ZapSign: ${error.message}`);
        return;
      }
      if (resp?.token) {
        const url = resp?.signers?.[0]?.sign_url;
        toast.success('Contrato enviado para ZapSign!', {
          description: 'Quando assinado, o PDF será anexado automaticamente a este pedido.',
          action: url ? { label: 'Abrir', onClick: () => window.open(url, '_blank') } : undefined,
          duration: 10000,
        });
        onOpenChange(false);
      } else if (resp?.error) {
        toast.error(`ZapSign: ${resp.error}${resp.status ? ` (${resp.status})` : ''}`);
      }
    } catch (err: any) {
      toast.error(`Falha: ${err?.message || 'erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar contrato para ZapSign — Pedido {pedido?.numero_pedido}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Modelo de contrato <span className="text-destructive">*</span></Label>
            <Select value={modeloId} onValueChange={setModeloId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {modelos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome} {m.is_padrao ? '★' : ''} ({m.ambiente})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCampos(buildCampos(pedido))}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Recarregar do pedido
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.k} className={`space-y-1 ${f.full ? 'md:col-span-2' : ''}`}>
                <Label className="text-xs">{f.label}</Label>
                <Input value={campos[f.k]} onChange={(e) => upd(f.k, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Signatários adicionais</p>
                {extraSigners.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {extraSigners.length + 1} no total
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={adicionarSignatario}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar signatário
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O contrato só será considerado assinado (e anexado ao pedido) quando <strong>todos</strong> os signatários assinarem.
            </p>

            {extraSigners.length === 0 ? (
              <div className="text-xs text-muted-foreground italic bg-muted/40 rounded-md p-3 text-center">
                Apenas o signatário principal acima irá assinar.
              </div>
            ) : (
              <div className="space-y-3">
                {extraSigners.map((s, idx) => (
                  <div key={idx} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">Signatário #{idx + 2}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => setExtraSigners((p) => p.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome *</Label>
                        <Input
                          value={s.name}
                          onChange={(e) => setExtraSigners((p) => p.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email *</Label>
                        <Input
                          type="email"
                          value={s.email}
                          onChange={(e) => setExtraSigners((p) => p.map((it, i) => i === idx ? { ...it, email: e.target.value } : it))}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs">Telefone (DDD + número)</Label>
                        <Input
                          value={s.phone_number}
                          onChange={(e) => setExtraSigners((p) => p.map((it, i) => i === idx ? { ...it, phone_number: e.target.value } : it))}
                          placeholder="5585999998888"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !modeloId}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar para ZapSign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AdminPasswordDialog
      open={askSenhaOpen}
      onOpenChange={setAskSenhaOpen}
      title="Confirmar envio do contrato"
      description="O contrato será enviado para assinatura via ZapSign. Digite a senha de administrador."
      actionLabel="Enviar contrato"
      onConfirm={enviar}
    />
    </>
  );
}