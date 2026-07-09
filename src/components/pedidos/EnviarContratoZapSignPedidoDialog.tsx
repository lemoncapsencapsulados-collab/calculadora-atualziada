import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, RotateCcw, Plus, Trash2, Users, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useContratoModelos } from '@/hooks/useContratoModelos';
import { useResumoContrato } from '@/hooks/useResumoContrato';
import { valorPorExtensoBRL, formatBRL, dataPorExtenso } from '@/lib/extenso';
import { Pedido } from '@/types/formula';
import { formatarNomeProprio, validarCPF } from '@/lib/validators';
import { formatarPagamentoResumo } from '@/lib/formatarPagamento';
import { formatarInsumoContrato, montarDadosZapSign, ZapSignContratoCampos, type ZapSignReplacement } from '@/lib/zapsignContrato';
import { ADMIN_PANEL_PASSWORD } from '@/lib/adminConfig';
import { RevisaoContratoZapSignDialog } from '@/components/zapsign/RevisaoContratoZapSignDialog';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pedido: Pedido | null;
}

type ExtraSigner = { name: string; email: string; phone_number: string };

function buildCandidatosExtras(pedido: Pedido | null, resumo?: any): ExtraSigner[] {
  const snap: any = pedido?.orcamento_snapshot || {};
  const dc: any = (resumo?.dados_cliente) || snap.dados_cliente || {};
  const out: ExtraSigner[] = [];
  const push = (nome?: string, email?: string, tel?: string) => {
    if (!nome && !email) return;
    out.push({
      name: formatarNomeProprio(nome || ''),
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
  push(dc.razao_social || resumo?.nome_cliente || snap.nome_cliente, dc.email, dc.telefone);
  // Remove duplicatas por email
  const seen = new Set<string>();
  return out.filter((s) => {
    const key = (s.email || s.name).toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type Campos = ZapSignContratoCampos;

function montarEnderecoPF(rep: any): string {
  return [
    [rep?.endereco || rep?.logradouro, rep?.numero].filter(Boolean).join(', '),
    rep?.bairro,
    rep?.cidade && rep?.estado ? `${rep.cidade} - ${rep.estado}` : (rep?.cidade || rep?.estado),
    rep?.cep ? `CEP ${String(rep.cep).replace(/(\d{5})(\d{3})/, '$1-$2')}` : '',
  ].filter(Boolean).join(' - ');
}

function buildCampos(pedido: Pedido | null, resumo?: any): Campos {
  const snap: any = pedido?.orcamento_snapshot || {};
  // Prefere os dados do Resumo/Projeto para Contrato (mais atualizados) sobre o snapshot original.
  const dc: any = (resumo?.dados_cliente) || snap.dados_cliente || {};
  const isPJ = dc.tipo_pessoa ? dc.tipo_pessoa === 'pj' : !!(dc.cnpj || dc.razao_social);
  const repPJ = (dc.responsavel_pj) || {};
  const repPF = (dc.pessoas_fisicas && dc.pessoas_fisicas[0]) || {};
  const rep: any = isPJ ? repPJ : repPF;
  const signerName = formatarNomeProprio(rep.nome || dc.razao_social || resumo?.nome_cliente || snap.nome_cliente || '');
  const signerEmail = rep.email || dc.email || '';
  const signerPhone = (rep.telefone || dc.telefone || '').replace(/\D/g, '');
  const razao = isPJ ? formatarNomeProprio(dc.razao_social || '') : formatarNomeProprio(rep.nome || '');
  const cnpj = isPJ ? (dc.cnpj || '') : (rep.cpf || '');
  const enderecoPJ = [
    [dc.logradouro || dc.endereco_cnpj, dc.numero].filter(Boolean).join(', '),
    dc.bairro,
    dc.cidade && dc.estado ? `${dc.cidade} - ${dc.estado}` : (dc.cidade || dc.estado),
    dc.cep_cnpj || dc.cep ? `CEP ${String(dc.cep_cnpj || dc.cep).replace(/(\d{5})(\d{3})/, '$1-$2')}` : '',
  ].filter(Boolean).join(' - ');
  const enderecoPF = [
    [rep.logradouro || rep.endereco, rep.numero].filter(Boolean).join(', '),
    rep.bairro,
    rep.cidade && rep.estado ? `${rep.cidade} - ${rep.estado}` : (rep.cidade || rep.estado),
    rep.cep ? `CEP ${String(rep.cep).replace(/(\d{5})(\d{3})/, '$1-$2')}` : '',
  ].filter(Boolean).join(' - ');
  const endereco = isPJ ? enderecoPJ : enderecoPF;
  const item = snap.itens_producao?.[0];
  const detalhesFonte = ((resumo?.detalhes_producao as any)?.[0] || (resumo?.detalhes_producao as any)?.['0'] || item?.detalhes_producao || {}) as Record<string, string>;
  const valorSetup = snap.subtotal_servicos || 0;
  const valorProd = snap.subtotal_producao || 0;
  const valorTotal = snap.valor_total || 0;
  const produtoValorTotal = item ? formatBRL(item.subtotal || (item.preco_unitario || 0) * (item.quantidade || 0)) : '';
  const condicaoPagamento = formatarPagamentoResumo(resumo?.condicoes_pagamento || snap.condicoes_pagamento, valorTotal).replace(/\n/g, '; ');
  const insumos = item?.insumos_formula || [];
  return {
    signer_name: signerName,
    signer_email: signerEmail,
    signer_phone_number: signerPhone,
    razao_social: razao,
    cnpj,
    endereco,
    endereco_representante: montarEnderecoPF(rep),
    email_contratante: dc.email || signerEmail,
    telefone_contratante: dc.telefone || signerPhone,
    nome_representante: formatarNomeProprio(rep.nome || ''),
    cpf_representante: rep.cpf || '',
    numero_contrato: resumo?.numero_orcamento || snap.numero_orcamento || pedido?.numero_pedido || '',
    data_contrato: dataPorExtenso(new Date()),
    produto_descricao: item ? `${item.nome_produto}${item.segmento ? ` (${item.segmento})` : ''}` : '',
    produto_apresentacao: item?.quantidade_por_pote ? `${item.quantidade_por_pote} ${item.unidade_por_pote || ''} por frasco`.trim() : '',
    produto_preco_unit: item ? formatBRL(item.preco_unitario) : '',
    produto_quantidade: item ? String(item.quantidade) : '',
    produto_valor_total: produtoValorTotal,
    valor_setup: formatBRL(valorSetup),
    valor_setup_extenso: valorPorExtensoBRL(valorSetup),
    valor_producao: formatBRL(valorProd),
    valor_producao_extenso: valorPorExtensoBRL(valorProd),
    valor_total: formatBRL(valorTotal),
    valor_total_extenso: valorPorExtensoBRL(valorTotal),
    valor_total_pedido: formatBRL(valorTotal),
    condicao_pagamento: condicaoPagamento,
    prazo_producao: '30 dias corridos após aprovação final dos rótulos',
    prazo_rotulos: '15 dias úteis',
    anexo_produto_nome: item?.nome_produto || '',
    anexo_qtd_frasco: item?.quantidade_por_pote ? `${item.quantidade_por_pote} ${item.unidade_por_pote || ''} por frasco`.trim() : '',
    anexo_dose_diaria: item?.dose_diaria_sugerida || '',
    anexo_ativo_1: formatarInsumoContrato(insumos[0]),
    anexo_ativo_2: formatarInsumoContrato(insumos[1]),
    anexo_cor_pote: detalhesFonte.cor_pote || '',
    anexo_cor_tampa: detalhesFonte.cor_tampa || '',
    anexo_cor_gummy: detalhesFonte.cor_gummy || detalhesFonte.cor_soluvel || detalhesFonte.cor_liquido || '',
    anexo_sabor_gummy: detalhesFonte.sabor_gummy || detalhesFonte.sabor_soluvel || detalhesFonte.sabor_liquido || '',
    anexo_quantidade: item ? String(item.quantidade) : '',
    anexo_preco_unitario: item ? formatBRL(item.preco_unitario) : '',
  };
}

export function EnviarContratoZapSignPedidoDialog({ open, onOpenChange, pedido }: Props) {
  const { data: modelos = [] } = useContratoModelos();
  const { data: resumoData } = useResumoContrato(pedido?.orcamento_id ?? null);
  const resumo = resumoData?.resumo;
  const [modeloId, setModeloId] = useState<string>('');
  const [campos, setCampos] = useState<Campos>(() => buildCampos(pedido, resumo));
  const [loading, setLoading] = useState(false);
  const [adminSenha, setAdminSenha] = useState('');
  const [extraSigners, setExtraSigners] = useState<ExtraSigner[]>([]);
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [ultimoCnpjConsultado, setUltimoCnpjConsultado] = useState<string>('');
  const [revisaoOpen, setRevisaoOpen] = useState(false);
  const [pendingEnvio, setPendingEnvio] = useState<{ campos: Campos; signers: ExtraSigner[] } | null>(null);

  const candidatosExtras = useMemo(() => buildCandidatosExtras(pedido, resumo), [pedido?.id, resumo?.id]);

  useEffect(() => {
    if (open) {
      setCampos(buildCampos(pedido, resumo));
      setExtraSigners([]);
      setAdminSenha('');
      setRevisaoOpen(false);
      setPendingEnvio(null);
    }
  }, [open, pedido?.id, resumo?.id]);

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

  const consultarCnpj = async (cnpjRaw: string) => {
    const nums = (cnpjRaw || '').replace(/\D/g, '');
    if (nums.length !== 14) return;
    if (nums === ultimoCnpjConsultado) return;
    setUltimoCnpjConsultado(nums);
    setConsultandoCnpj(true);
    try {
      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${nums}`);
      if (!resp.ok) {
        toast.error('CNPJ não encontrado na Receita.');
        return;
      }
      const d = await resp.json();
      const endereco = [
        [d.logradouro, d.numero].filter(Boolean).join(', '),
        d.complemento,
        d.bairro,
        d.municipio && d.uf ? `${d.municipio} - ${d.uf}` : (d.municipio || d.uf),
        d.cep ? `CEP ${String(d.cep).replace(/(\d{5})(\d{3})/, '$1-$2')}` : '',
      ].filter(Boolean).join(' - ');
      const telefone = [d.ddd_telefone_1, d.ddd_telefone_2].filter(Boolean).join(' / ');
      setCampos((p) => ({
        ...p,
        razao_social: p.razao_social?.trim() ? p.razao_social : (d.razao_social || d.nome_fantasia || ''),
        endereco: p.endereco?.trim() ? p.endereco : endereco,
        email_contratante: p.email_contratante?.trim() ? p.email_contratante : (d.email || ''),
        telefone_contratante: p.telefone_contratante?.trim() ? p.telefone_contratante : telefone,
      }));
      toast.success('Dados do CNPJ preenchidos automaticamente.');
    } catch (e: any) {
      toast.error(`Falha ao consultar CNPJ: ${e?.message || 'erro'}`);
    } finally {
      setConsultandoCnpj(false);
    }
  };

  const fields: Array<{ k: keyof Campos; label: string; full?: boolean }> = useMemo(() => ([
    { k: 'signer_name', label: 'Nome do signatário' },
    { k: 'signer_email', label: 'Email do signatário' },
    { k: 'signer_phone_number', label: 'Telefone (com DDD)' },
    { k: 'razao_social', label: 'Razão social / Nome' },
    { k: 'cnpj', label: 'CNPJ / CPF' },
    { k: 'endereco', label: 'Endereço', full: true },
    { k: 'email_contratante', label: 'Email do contratante' },
    { k: 'telefone_contratante', label: 'Telefone do contratante' },
    { k: 'nome_representante', label: 'Nome do representante legal *' },
    { k: 'cpf_representante', label: 'CPF do representante legal *' },
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

  const handleSubmit = async () => {
    const modelo = modelos.find((m) => m.id === modeloId);
    if (!modelo) { toast.error('Selecione um modelo de contrato.'); return; }
    if (!campos.signer_name || !campos.signer_email) {
      toast.error('Preencha nome e email do signatário.');
      return;
    }
    if (!campos.nome_representante?.trim()) {
      toast.error('Informe o nome do representante legal.');
      return;
    }
    const cpfRep = (campos.cpf_representante || '').replace(/\D/g, '');
    if (!cpfRep || !validarCPF(cpfRep)) {
      toast.error('Informe um CPF válido para o representante legal.');
      return;
    }
    for (const s of extraSigners) {
      if (!s.name?.trim() || !s.email?.trim()) {
        toast.error('Preencha nome e email de todos os signatários adicionais.');
        return;
      }
    }
    if (!pedido) return;
    if (adminSenha !== ADMIN_PANEL_PASSWORD) {
      toast.error('Senha de administrador incorreta.');
      setAdminSenha('');
      return;
    }
    // Normaliza nomes em Title Case antes do envio
    const camposNormalizados = {
      ...campos,
      signer_name: formatarNomeProprio(campos.signer_name),
      razao_social: formatarNomeProprio(campos.razao_social),
      nome_representante: formatarNomeProprio(campos.nome_representante),
    };
    const signersNormalizados = extraSigners.map((s) => ({ ...s, name: formatarNomeProprio(s.name) }));
    setCampos(camposNormalizados);
    setExtraSigners(signersNormalizados);
    setPendingEnvio({ campos: camposNormalizados, signers: signersNormalizados });
    setRevisaoOpen(true);
  };

  const enviar = async (camposEnvio = campos, extraSignersEnvio = extraSigners, finalReplacements?: ZapSignReplacement[]) => {
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

      const data = finalReplacements?.length ? finalReplacements : montarDadosZapSign(camposEnvio);

      // Email configurado no modelo (cópia automática)
      const extrasConfigurados: ExtraSigner[] = [];
      if (modelo.email_envio?.trim()) {
        extrasConfigurados.push({
          name: (modelo.nome_envio?.trim() || modelo.nome || 'Cópia do contrato'),
          email: modelo.email_envio.trim(),
          phone_number: '',
        });
      }
      // Mescla com extras manuais, removendo duplicatas por email
      const mapExtras = new Map<string, ExtraSigner>();
      [...extrasConfigurados, ...extraSignersEnvio].forEach((s) => {
        const key = (s.email || s.name).toLowerCase().trim();
        if (key && !mapExtras.has(key)) mapExtras.set(key, s);
      });
      // Não duplica o signatário principal
      mapExtras.delete((camposEnvio.signer_email || '').toLowerCase().trim());
      const extrasFinal = Array.from(mapExtras.values());

      const { data: resp, error } = await supabase.functions.invoke('criar-contrato-zapsign', {
        body: {
          signer_name: camposEnvio.signer_name,
          signer_email: camposEnvio.signer_email,
          signer_phone_country: '55',
          signer_phone_number: (camposEnvio.signer_phone_number || '').replace(/\D/g, ''),
          lang: 'pt-br',
          send_automatic_email: true,
          data,
          template_id: modelo.template_id,
          ambiente: modelo.ambiente,
          pedido_id: pedido.id,
          orcamento_id: pedido.orcamento_id ?? null,
          cliente_id,
          extra_signers: extrasFinal
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
        const ctx: any = (error as any).context;
        let extra = '';
        try {
          const txt = ctx && typeof ctx.text === 'function' ? await ctx.text() : '';
          const parsed = txt ? JSON.parse(txt) : null;
          extra = parsed?.details || parsed?.error || txt;
        } catch { /* noop */ }
        toast.error(`Erro ZapSign: ${extra || error.message}`, { duration: 10000 });
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
            <Button type="button" variant="ghost" size="sm" onClick={() => setCampos(buildCampos(pedido, resumo))}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Recarregar {resumo ? 'do resumo/contrato' : 'do pedido'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.k} className={`space-y-1 ${f.full ? 'md:col-span-2' : ''}`}>
                <Label className="text-xs flex items-center gap-2">
                  {f.label}
                  {f.k === 'cnpj' && consultandoCnpj && (
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  )}
                </Label>
                <Input
                  value={campos[f.k]}
                  onChange={(e) => upd(f.k, e.target.value)}
                  onBlur={(e) => {
                    if (f.k === 'cnpj') {
                      consultarCnpj(e.target.value);
                    } else if (
                      f.k === 'signer_name' ||
                      f.k === 'razao_social' ||
                      f.k === 'nome_representante'
                    ) {
                      upd(f.k, formatarNomeProprio(e.target.value));
                    }
                  }}
                />
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
                          onBlur={(e) => setExtraSigners((p) => p.map((it, i) => i === idx ? { ...it, name: formatarNomeProprio(e.target.value) } : it))}
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

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-xs space-y-1 text-left">
            <Label htmlFor="pedido-zap-admin-senha" className="text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Senha admin para enviar
            </Label>
            <Input
              id="pedido-zap-admin-senha"
              type="password"
              value={adminSenha}
              onChange={(e) => setAdminSenha(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading && modeloId) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Digite a senha"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !modeloId || !adminSenha}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar para ZapSign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {pendingEnvio && (() => {
      const modelo = modelos.find((m) => m.id === modeloId);
      if (!modelo) return null;
      const replacements = montarDadosZapSign(pendingEnvio.campos);
      return (
        <RevisaoContratoZapSignDialog
          open={revisaoOpen}
          onOpenChange={(o) => { if (!loading) setRevisaoOpen(o); }}
          templateId={modelo.template_id}
          ambiente={modelo.ambiente as 'producao' | 'sandbox'}
          modeloNome={modelo.nome}
          replacements={replacements}
          sending={loading}
          onConfirm={async (finalReplacements) => {
            await enviar(pendingEnvio.campos, pendingEnvio.signers, finalReplacements);
            setRevisaoOpen(false);
          }}
        />
      );
    })()}
    </>
  );
}