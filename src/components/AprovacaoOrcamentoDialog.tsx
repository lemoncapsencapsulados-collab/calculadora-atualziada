import { useState, useEffect } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { usePedidos } from '@/hooks/usePedidos';
import { Orcamento, DadosCliente, DetalhamentoFrete, DetalhamentoEnvio, CondicoesPagamento, PessoaFisicaResponsavel } from '@/types/orcamento';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Truck, PackageCheck, Search, ShoppingBag, AlertTriangle, Wallet, CheckCircle2, CalendarIcon, Beaker, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import CondicoesPagamentoForm, { validarCondicoesPagamento } from './CondicoesPagamentoForm';
import { ESTADOS_CIVIS, UFS_BRASIL, fetchCidadesPorUF, getOpcoesPote, getOpcoesTampa } from '@/lib/brasilData';

interface AprovacaoOrcamentoDialogProps {
  orcamento: Orcamento;
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_PF: PessoaFisicaResponsavel = {
  nome: '', cpf: '', rg: '', endereco: '', cep: '', cidade: '', estado: '', telefone: '', email: '', estado_civil: '',
};

function PessoaFisicaFields({ pessoa, onChange, label }: { pessoa: PessoaFisicaResponsavel; onChange: (p: PessoaFisicaResponsavel) => void; label: string }) {
  const update = (field: keyof PessoaFisicaResponsavel, value: string) => onChange({ ...pessoa, [field]: value });
  const [cidadesPF, setCidadesPF] = useState<string[]>([]);
  const [loadingCidadesPF, setLoadingCidadesPF] = useState(false);

  useEffect(() => {
    if (pessoa.estado && pessoa.estado.length === 2) {
      setLoadingCidadesPF(true);
      fetchCidadesPorUF(pessoa.estado).then(c => { setCidadesPF(c); setLoadingCidadesPF(false); });
    } else {
      setCidadesPF([]);
    }
  }, [pessoa.estado]);

  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
          <Input value={pessoa.nome || ''} onChange={(e) => update('nome', e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CPF <span className="text-destructive">*</span></Label>
          <Input value={pessoa.cpf || ''} onChange={(e) => update('cpf', e.target.value)} placeholder="000.000.000-00" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">RG <span className="text-destructive">*</span></Label>
          <Input value={pessoa.rg || ''} onChange={(e) => update('rg', e.target.value)} placeholder="RG" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado Civil <span className="text-destructive">*</span></Label>
          <Select value={pessoa.estado_civil || ''} onValueChange={(v) => update('estado_civil', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {ESTADOS_CIVIS.map(ec => <SelectItem key={ec} value={ec}>{ec}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Endereço <span className="text-destructive">*</span></Label>
          <Input value={pessoa.endereco || ''} onChange={(e) => update('endereco', e.target.value)} placeholder="Rua, número, bairro" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CEP <span className="text-destructive">*</span></Label>
          <Input value={pessoa.cep || ''} onChange={(e) => update('cep', e.target.value)} placeholder="00000-000" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado <span className="text-destructive">*</span></Label>
          <Select value={pessoa.estado || ''} onValueChange={(v) => { update('estado', v); onChange({ ...pessoa, estado: v, cidade: '' }); }}>
            <SelectTrigger><SelectValue placeholder="Selecione UF" /></SelectTrigger>
            <SelectContent>
              {UFS_BRASIL.map(u => <SelectItem key={u.uf} value={u.uf}>{u.uf} — {u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cidade <span className="text-destructive">*</span></Label>
          <Select value={pessoa.cidade || ''} onValueChange={(v) => update('cidade', v)} disabled={!pessoa.estado || loadingCidadesPF}>
            <SelectTrigger><SelectValue placeholder={loadingCidadesPF ? 'Carregando...' : !pessoa.estado ? 'Selecione o estado' : 'Selecione'} /></SelectTrigger>
            <SelectContent>
              {cidadesPF.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Telefone <span className="text-destructive">*</span></Label>
          <Input value={pessoa.telefone || ''} onChange={(e) => update('telefone', e.target.value)} placeholder="(00) 00000-0000" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
          <Input type="email" value={pessoa.email || ''} onChange={(e) => update('email', e.target.value)} placeholder="email@exemplo.com" />
        </div>
      </div>
    </div>
  );
}

function validatePF(pf: PessoaFisicaResponsavel, label: string): string[] {
  const missing: string[] = [];
  if (!pf.nome?.trim()) missing.push(`Nome (${label})`);
  if (!pf.cpf?.trim()) missing.push(`CPF (${label})`);
  if (!pf.rg?.trim()) missing.push(`RG (${label})`);
  if (!pf.endereco?.trim()) missing.push(`Endereço (${label})`);
  if (!pf.cep?.trim()) missing.push(`CEP (${label})`);
  if (!pf.cidade?.trim()) missing.push(`Cidade (${label})`);
  if (!pf.estado?.trim()) missing.push(`Estado (${label})`);
  if (!pf.telefone?.trim()) missing.push(`Telefone (${label})`);
  if (!pf.email?.trim()) missing.push(`Email (${label})`);
  if (!pf.estado_civil?.trim()) missing.push(`Estado Civil (${label})`);
  return missing;
}

function CidadeSelectPJ({ estado, cidade, onChange }: { estado: string; cidade: string; onChange: (v: string) => void }) {
  const [cidades, setCidades] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (estado && estado.length === 2) {
      setLoading(true);
      fetchCidadesPorUF(estado).then(c => { setCidades(c); setLoading(false); });
    } else { setCidades([]); }
  }, [estado]);
  return (
    <Select value={cidade} onValueChange={onChange} disabled={!estado || loading}>
      <SelectTrigger><SelectValue placeholder={loading ? 'Carregando...' : !estado ? 'Selecione o estado' : 'Selecione'} /></SelectTrigger>
      <SelectContent>
        {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function AprovacaoOrcamentoDialog({ orcamento, onClose, onSuccess }: AprovacaoOrcamentoDialogProps) {
  const { updateDadosCliente, updateDetalhamentoFrete, updateOrcamento, updateStatus } = useOrcamentos();
  const { createPedidoFromOrcamento } = usePedidos();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);

  // Data de pagamento
  const [dataPagamento, setDataPagamento] = useState<Date | undefined>(
    orcamento.data_pagamento ? new Date(orcamento.data_pagamento) : undefined
  );

  // Tipo pessoa
  const [tipoPessoa, setTipoPessoa] = useState<'pj' | 'pf'>('pj');

  // Dados PJ
  const [dadosCliente, setDadosCliente] = useState<DadosCliente>({
    tipo_pessoa: 'pj',
    cnpj: '', razao_social: '', inscricao_municipal: '', inscricao_estadual: '',
    endereco_cnpj: '', cep_cnpj: '', cidade: '', estado: '', telefone: '', email: '',
  });

  // Responsável PJ (QSA)
  const [responsavelPJ, setResponsavelPJ] = useState<PessoaFisicaResponsavel>({ ...EMPTY_PF });

  // PF - lista
  const [pessoasFisicas, setPessoasFisicas] = useState<PessoaFisicaResponsavel[]>([{ ...EMPTY_PF }]);

  // Forma de venda
  const [formaVenda, setFormaVenda] = useState<string>('sem_informacao');

  // Frete
  const [freteLemonCaps, setFreteLemonCaps] = useState<boolean>(true);
  const [usaTabelaTradicional, setUsaTabelaTradicional] = useState<boolean>(true);
  const [detalhamentoEnvio, setDetalhamentoEnvio] = useState<DetalhamentoEnvio>({
    tipo: 'total_lemoncaps', descricao_parcial: '',
  });

  // Detalhes de produção por item
  const [detalhesProducao, setDetalhesProducao] = useState<Record<number, Record<string, string>>>({});

  const updateDetalhe = (idx: number, campo: string, valor: string) => {
    setDetalhesProducao(prev => ({
      ...prev,
      [idx]: { ...(prev[idx] || {}), [campo]: valor },
    }));
  };

  // Condições de pagamento
  const [condicoesPagamento, setCondicoesPagamento] = useState<CondicoesPagamento>(
    orcamento.condicoes_pagamento || {}
  );
  const [errosPagamento, setErrosPagamento] = useState<string[]>([]);

  useEffect(() => {
    if (orcamento.dados_cliente) {
      const dc = orcamento.dados_cliente;
      setDadosCliente(prev => ({ ...prev, ...dc }));
      setTipoPessoa(dc.tipo_pessoa || 'pj');
      setFormaVenda(dc.forma_venda || 'sem_informacao');
      if (dc.responsavel_pj) setResponsavelPJ(dc.responsavel_pj);
      if (dc.pessoas_fisicas && dc.pessoas_fisicas.length > 0) setPessoasFisicas(dc.pessoas_fisicas);
    }
    if (orcamento.detalhamento_frete) {
      setFreteLemonCaps(orcamento.detalhamento_frete.frete_lemon_caps ?? true);
      setUsaTabelaTradicional(orcamento.detalhamento_frete.usa_tabela_tradicional ?? true);
      if (orcamento.detalhamento_frete.detalhamento_envio) {
        setDetalhamentoEnvio(orcamento.detalhamento_frete.detalhamento_envio);
      }
    }
    if (orcamento.condicoes_pagamento) {
      setCondicoesPagamento(orcamento.condicoes_pagamento);
    }
  }, [orcamento]);

  // Auto-set frete when envio tipo changes
  useEffect(() => {
    if (detalhamentoEnvio.tipo === 'total_produtor') {
      setFreteLemonCaps(false);
    }
  }, [detalhamentoEnvio.tipo]);

  const handleBuscarCnpj = async () => {
    const cnpj = dadosCliente.cnpj?.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) return;
    setIsSearchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (response.ok) {
        const data = await response.json();
        setDadosCliente(prev => ({
          ...prev,
          razao_social: data.razao_social || '',
          endereco_cnpj: [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(', ') || '',
          cep_cnpj: data.cep || '',
          cidade: data.municipio || '',
          estado: data.uf || '',
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleConfirmAprovacao = async () => {
    const camposFaltando: string[] = [];

    // Validate client based on tipo_pessoa
    if (tipoPessoa === 'pj') {
      if (!dadosCliente.cnpj?.trim()) camposFaltando.push('CNPJ');
      if (!dadosCliente.razao_social?.trim()) camposFaltando.push('Razão Social');
      // inscricao_municipal and inscricao_estadual are optional
      if (!dadosCliente.endereco_cnpj?.trim()) camposFaltando.push('Endereço');
      if (!dadosCliente.cep_cnpj?.trim()) camposFaltando.push('CEP');
      if (!dadosCliente.cidade?.trim()) camposFaltando.push('Cidade');
      if (!dadosCliente.estado?.trim()) camposFaltando.push('Estado');
      if (!dadosCliente.telefone?.trim()) camposFaltando.push('Telefone');
      if (!dadosCliente.email?.trim()) camposFaltando.push('Email');
      // Validate responsável PJ (QSA)
      camposFaltando.push(...validatePF(responsavelPJ, 'Responsável QSA'));
    } else {
      // PF
      pessoasFisicas.forEach((pf, i) => {
        camposFaltando.push(...validatePF(pf, `Pessoa Física ${i + 1}`));
      });
    }

    // Validar detalhes de produção por item
    orcamento.itens_producao.forEach((item, idx) => {
      const seg = (item.segmento || '').toLowerCase();
      const d = detalhesProducao[idx] || {};

      // All types need cor_pote and cor_tampa
      const isEncapsulado = seg.includes('encapsulado');
      const isGummy = seg.includes('gummy');
      const isSoluvel = seg.includes('solúvel') || seg.includes('soluvel');
      const isLiquido = seg.includes('líquido') || seg.includes('liquido');
      const isKnown = isEncapsulado || isGummy || isSoluvel || isLiquido;

      if (isKnown) {
        if (!d.cor_tampa) camposFaltando.push(`Cor da Tampa (${item.nome_produto})`);
        if (!d.cor_pote) camposFaltando.push(`Cor do Pote (${item.nome_produto})`);
      }

      // Gummy, Líquido, Solúvel need sabor and cor do conteúdo
      if (isGummy) {
        if (!d.sabor_gummy) camposFaltando.push(`Sabor (${item.nome_produto})`);
        if (!d.cor_gummy) camposFaltando.push(`Cor do Conteúdo (${item.nome_produto})`);
      } else if (isSoluvel) {
        if (!d.sabor_soluvel) camposFaltando.push(`Sabor (${item.nome_produto})`);
        if (!d.cor_soluvel) camposFaltando.push(`Cor do Conteúdo (${item.nome_produto})`);
      } else if (isLiquido) {
        if (!d.sabor_liquido) camposFaltando.push(`Sabor (${item.nome_produto})`);
        if (!d.cor_liquido) camposFaltando.push(`Cor do Conteúdo (${item.nome_produto})`);
      } else if (!isEncapsulado) {
        if (!d.observacao_producao) camposFaltando.push(`Observação de Produção (${item.nome_produto})`);
      }
    });

    if (!dataPagamento) camposFaltando.push('Data de Pagamento');

    const erros = validarCondicoesPagamento(condicoesPagamento);
    if (erros.length > 0) {
      setErrosPagamento(erros);
      if (camposFaltando.length === 0) return;
    } else {
      setErrosPagamento([]);
    }

    if (camposFaltando.length > 0) {
      const { toast } = await import('@/hooks/use-toast');
      toast({
        title: 'Campos obrigatórios não preenchidos',
        description: camposFaltando.join(', '),
        variant: 'destructive',
      });
      return;
    }

    if (erros.length > 0) return;

    setIsSubmitting(true);

    try {
      const dadosClienteCompletos: DadosCliente = {
        ...dadosCliente,
        tipo_pessoa: tipoPessoa,
        forma_venda: formaVenda as DadosCliente['forma_venda'],
        responsavel_pj: tipoPessoa === 'pj' ? responsavelPJ : undefined,
        pessoas_fisicas: tipoPessoa === 'pf' ? pessoasFisicas : undefined,
      };

      const detalhamentoFrete: DetalhamentoFrete = {
        frete_lemon_caps: freteLemonCaps,
        usa_tabela_tradicional: usaTabelaTradicional,
        planos_customizados: orcamento.detalhamento_frete?.planos_customizados || [],
        detalhamento_envio: detalhamentoEnvio,
      };

      const itensComDetalhes = orcamento.itens_producao.map((item, idx) => ({
        ...item,
        detalhes_producao: detalhesProducao[idx] || undefined,
      }));

      await updateDadosCliente.mutateAsync({ id: orcamento.id, dados_cliente: dadosClienteCompletos });
      await updateDetalhamentoFrete.mutateAsync({ id: orcamento.id, detalhamento_frete: detalhamentoFrete });
      await updateOrcamento.mutateAsync({
        id: orcamento.id,
        updates: { condicoes_pagamento: condicoesPagamento, itens_producao: itensComDetalhes },
      });

      await updateStatus.mutateAsync({
        id: orcamento.id,
        status: 'pago',
        data_pagamento: dataPagamento!.toISOString(),
      });

      const orcamentoCompleto = {
        ...orcamento,
        itens_producao: itensComDetalhes,
        dados_cliente: dadosClienteCompletos,
        detalhamento_frete: detalhamentoFrete,
        condicoes_pagamento: condicoesPagamento,
        data_pagamento: dataPagamento!.toISOString(),
      };

      await createPedidoFromOrcamento(orcamentoCompleto);

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao aprovar orçamento:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Confirmar Pagamento — {orcamento.nome_cliente}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Preencha os dados da proposta comercial para confirmar o pagamento. Um pedido será criado automaticamente.
          </p>

          {/* 1. Informações do Cliente */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                1. Informações do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selector PJ / PF */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tipo de Pessoa <span className="text-destructive">*</span></Label>
                <Select value={tipoPessoa} onValueChange={(v) => setTipoPessoa(v as 'pj' | 'pf')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                    <SelectItem value="pf">Pessoa Física</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoPessoa === 'pj' && (
                <div className="space-y-4">
                  {/* PJ Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">CNPJ <span className="text-destructive">*</span></Label>
                      <div className="flex gap-2">
                        <Input value={dadosCliente.cnpj || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" className="flex-1" />
                        <Button type="button" variant="outline" size="sm" onClick={handleBuscarCnpj} disabled={isSearchingCnpj || !dadosCliente.cnpj}>
                          {isSearchingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Razão Social <span className="text-destructive">*</span></Label>
                      <Input value={dadosCliente.razao_social || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, razao_social: e.target.value }))} placeholder="Razão social" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Inscrição Municipal</Label>
                      <Input value={dadosCliente.inscricao_municipal || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, inscricao_municipal: e.target.value }))} placeholder="Inscrição municipal" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Inscrição Estadual</Label>
                      <Input value={dadosCliente.inscricao_estadual || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, inscricao_estadual: e.target.value }))} placeholder="Inscrição estadual" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Endereço <span className="text-destructive">*</span></Label>
                      <Input value={dadosCliente.endereco_cnpj || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, endereco_cnpj: e.target.value }))} placeholder="Rua, número, bairro" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CEP <span className="text-destructive">*</span></Label>
                      <Input value={dadosCliente.cep_cnpj || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, cep_cnpj: e.target.value }))} placeholder="00000-000" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Estado <span className="text-destructive">*</span></Label>
                      <Select value={dadosCliente.estado || ''} onValueChange={(v) => { setDadosCliente(prev => ({ ...prev, estado: v, cidade: '' })); }}>
                        <SelectTrigger><SelectValue placeholder="Selecione UF" /></SelectTrigger>
                        <SelectContent>
                          {UFS_BRASIL.map(u => <SelectItem key={u.uf} value={u.uf}>{u.uf} — {u.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cidade <span className="text-destructive">*</span></Label>
                      <CidadeSelectPJ estado={dadosCliente.estado || ''} cidade={dadosCliente.cidade || ''} onChange={(v) => setDadosCliente(prev => ({ ...prev, cidade: v }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefone <span className="text-destructive">*</span></Label>
                      <Input value={dadosCliente.telefone || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Email (recebimento de NF) <span className="text-destructive">*</span></Label>
                      <Input type="email" value={dadosCliente.email || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, email: e.target.value }))} placeholder="email@exemplo.com" />
                    </div>
                  </div>

                  {/* Responsável PF (QSA) */}
                  <PessoaFisicaFields
                    pessoa={responsavelPJ}
                    onChange={setResponsavelPJ}
                    label="Responsável PF (QSA)"
                  />
                </div>
              )}

              {tipoPessoa === 'pf' && (
                <div className="space-y-3">
                  {pessoasFisicas.map((pf, i) => (
                    <div key={i} className="relative">
                      <PessoaFisicaFields
                        pessoa={pf}
                        onChange={(updated) => {
                          const newList = [...pessoasFisicas];
                          newList[i] = updated;
                          setPessoasFisicas(newList);
                        }}
                        label={`Pessoa Física ${i + 1}`}
                      />
                      {pessoasFisicas.length > 1 && (
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="absolute top-2 right-2 h-6 w-6 text-destructive"
                          onClick={() => setPessoasFisicas(prev => prev.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => setPessoasFisicas(prev => [...prev, { ...EMPTY_PF }])}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Pessoa
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Detalhes do Produto */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Beaker className="w-4 h-4" />
                2. Detalhes do Produto <span className="text-xs text-destructive font-normal">(obrigatório)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {orcamento.itens_producao.map((item, idx) => {
                const seg = (item.segmento || '').toLowerCase();
                const isEncapsulado = seg.includes('encapsulado');
                const isGummy = seg.includes('gummy');
                const isSoluvel = seg.includes('solúvel') || seg.includes('soluvel');
                const isLiquido = seg.includes('líquido') || seg.includes('liquido');
                const isKnown = isEncapsulado || isGummy || isSoluvel || isLiquido;
                const isOutro = !isKnown;
                const d = detalhesProducao[idx] || {};

                return (
                  <div key={idx} className="bg-muted/50 rounded-lg p-3 space-y-3">
                    <div>
                      <p className="text-sm font-medium">{item.nome_produto}</p>
                      <p className="text-xs text-muted-foreground">Qtd: {item.quantidade} — {item.segmento}</p>
                      {item.dose_diaria_sugerida && (
                        <p className="text-xs text-muted-foreground">Dose diária: {item.dose_diaria_sugerida}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Cor da Tampa e Cor do Pote — todos os tipos conhecidos */}
                      {isKnown && (() => {
                        const opcoesTampa = getOpcoesTampa(seg);
                        const opcoesPote = getOpcoesPote(seg);
                        return (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Cor da Tampa <span className="text-destructive">*</span></Label>
                              <Select value={d.cor_tampa || (opcoesTampa.length === 1 ? opcoesTampa[0] : '')} onValueChange={(v) => updateDetalhe(idx, 'cor_tampa', v)}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  {opcoesTampa.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Cor do Pote <span className="text-destructive">*</span></Label>
                              <Select value={d.cor_pote || (opcoesPote.length === 1 ? opcoesPote[0] : '')} onValueChange={(v) => updateDetalhe(idx, 'cor_pote', v)}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  {opcoesPote.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        );
                      })()}
                      {/* Sabor e Cor do Conteúdo — Gummy, Solúvel, Líquido */}
                      {isGummy && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Sabor <span className="text-destructive">*</span></Label>
                            <Select value={d.sabor_gummy || ''} onValueChange={(v) => updateDetalhe(idx, 'sabor_gummy', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Frutas vermelhas">Frutas vermelhas</SelectItem>
                                <SelectItem value="Morango">Morango</SelectItem>
                                <SelectItem value="Uva">Uva</SelectItem>
                                <SelectItem value="Limão">Limão</SelectItem>
                                <SelectItem value="Maçã verde">Maçã verde</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cor do Conteúdo <span className="text-destructive">*</span></Label>
                            <Select value={d.cor_gummy || ''} onValueChange={(v) => updateDetalhe(idx, 'cor_gummy', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Vermelho">Vermelho</SelectItem>
                                <SelectItem value="Roxo">Roxo</SelectItem>
                                <SelectItem value="Verde">Verde</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      {isSoluvel && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Sabor <span className="text-destructive">*</span></Label>
                            <Select value={d.sabor_soluvel || ''} onValueChange={(v) => updateDetalhe(idx, 'sabor_soluvel', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Limão">Limão</SelectItem>
                                <SelectItem value="Frutas vermelhas">Frutas vermelhas</SelectItem>
                                <SelectItem value="Morango">Morango</SelectItem>
                                <SelectItem value="Uva">Uva</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cor do Conteúdo <span className="text-destructive">*</span></Label>
                            <Select value={d.cor_soluvel || ''} onValueChange={(v) => updateDetalhe(idx, 'cor_soluvel', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Verde">Verde</SelectItem>
                                <SelectItem value="Vermelho">Vermelho</SelectItem>
                                <SelectItem value="Roxo">Roxo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      {isLiquido && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Sabor <span className="text-destructive">*</span></Label>
                            <Select value={d.sabor_liquido || ''} onValueChange={(v) => updateDetalhe(idx, 'sabor_liquido', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Limão">Limão</SelectItem>
                                <SelectItem value="Frutas vermelhas">Frutas vermelhas</SelectItem>
                                <SelectItem value="Morango">Morango</SelectItem>
                                <SelectItem value="Uva">Uva</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cor do Conteúdo <span className="text-destructive">*</span></Label>
                            <Select value={d.cor_liquido || ''} onValueChange={(v) => updateDetalhe(idx, 'cor_liquido', v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Verde">Verde</SelectItem>
                                <SelectItem value="Vermelho">Vermelho</SelectItem>
                                <SelectItem value="Roxo">Roxo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      {isOutro && (
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Observação de Produção <span className="text-destructive">*</span></Label>
                          <Textarea
                            value={d.observacao_producao || ''}
                            onChange={(e) => updateDetalhe(idx, 'observacao_producao', e.target.value)}
                            placeholder="Descreva os detalhes de produção para este produto..."
                            className="min-h-[60px]"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 3. Forma de Venda */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                3. Forma de Venda do Cliente <span className="text-xs text-destructive font-normal">*</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={formaVenda} onValueChange={setFormaVenda} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="locais_fisicos" id="aprov-locais" />
                  <Label htmlFor="aprov-locais" className="font-normal cursor-pointer">Locais físicos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="venda_digital" id="aprov-digital" />
                  <Label htmlFor="aprov-digital" className="font-normal cursor-pointer">Venda digital</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ambas" id="aprov-ambas" />
                  <Label htmlFor="aprov-ambas" className="font-normal cursor-pointer">Ambas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sem_informacao" id="aprov-sem" />
                  <Label htmlFor="aprov-sem" className="font-normal cursor-pointer">Sem informação</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* 4. Detalhamento de Frete */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-4 h-4" />
                4. Detalhamento de Frete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm flex items-center gap-2">
                  <PackageCheck className="w-4 h-4" />
                  Como será feita a logística?
                </Label>
                <RadioGroup
                  value={detalhamentoEnvio.tipo}
                  onValueChange={(value) => setDetalhamentoEnvio(prev => ({
                    ...prev,
                    tipo: value as DetalhamentoEnvio['tipo'],
                    descricao_parcial: value !== 'parcial' ? '' : prev.descricao_parcial,
                  }))}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="total_produtor" id="aprov-produtor" />
                    <Label htmlFor="aprov-produtor" className="font-normal cursor-pointer text-sm">Todo envio para o Produtor</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="total_lemoncaps" id="aprov-lemoncaps" />
                    <Label htmlFor="aprov-lemoncaps" className="font-normal cursor-pointer text-sm">Toda logística via Lemon Caps</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="parcial" id="aprov-parcial" />
                    <Label htmlFor="aprov-parcial" className="font-normal cursor-pointer text-sm">Envio Parcial</Label>
                  </div>
                </RadioGroup>

                {detalhamentoEnvio.tipo === 'parcial' && (
                  <div className="ml-6 space-y-2">
                    <Label className="text-xs text-muted-foreground">Descreva a divisão:</Label>
                    <Textarea
                      value={detalhamentoEnvio.descricao_parcial || ''}
                      onChange={(e) => setDetalhamentoEnvio(prev => ({ ...prev, descricao_parcial: e.target.value }))}
                      placeholder="Ex: 50 potes para produtor, 100 potes logística Lemon Caps"
                      rows={2}
                    />
                  </div>
                )}

                {detalhamentoEnvio.tipo === 'total_produtor' && (
                  <p className="text-xs text-muted-foreground ml-6">
                    Não será utilizada logística da LemonCaps para cliente final.
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t">
                <Label className="text-sm">Frete via Lemon Caps para cliente final?</Label>
                <div className="flex gap-3">
                  <Button type="button" variant={freteLemonCaps ? 'default' : 'outline'} size="sm" onClick={() => setFreteLemonCaps(true)}>Sim</Button>
                  <Button type="button" variant={!freteLemonCaps ? 'default' : 'outline'} size="sm" onClick={() => setFreteLemonCaps(false)}>Não</Button>
                </div>
              </div>

              {freteLemonCaps && (
                <div className="space-y-3">
                  <Label className="text-sm">Usar tabela tradicional de envio?</Label>
                  <div className="flex gap-3">
                    <Button type="button" variant={usaTabelaTradicional ? 'default' : 'outline'} size="sm" onClick={() => setUsaTabelaTradicional(true)}>Sim</Button>
                    <Button type="button" variant={!usaTabelaTradicional ? 'default' : 'outline'} size="sm" onClick={() => setUsaTabelaTradicional(false)}>Não</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. Condições de Pagamento */}
          <Card className={errosPagamento.length > 0 ? 'border-destructive' : ''}>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                5. Condições de Pagamento
                <span className="text-xs text-destructive font-normal">(obrigatório)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CondicoesPagamentoForm
                value={condicoesPagamento}
                onChange={(value) => { setCondicoesPagamento(value); setErrosPagamento([]); }}
                valorTotal={orcamento.valor_total}
                isRequired={true}
              />
              {errosPagamento.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {errosPagamento.map((erro, i) => (<li key={i}>{erro}</li>))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* 6. Data de Pagamento */}
          <Card className={!dataPagamento ? 'border-destructive' : 'border-green-500'}>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                6. Data do Pagamento do Cliente
                <span className="text-xs text-destructive font-normal">(obrigatório)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !dataPagamento && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataPagamento ? format(dataPagamento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dataPagamento}
                    onSelect={setDataPagamento}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirmAprovacao}
            disabled={!dataPagamento || isSubmitting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirmando...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar Pagamento</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
