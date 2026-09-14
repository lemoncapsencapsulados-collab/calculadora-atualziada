import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { usePedidos } from '@/hooks/usePedidos';
import { useClientes, Cliente } from '@/hooks/useClientes';
import ClienteSelector from '@/components/ClienteSelector';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Truck, PackageCheck, Search, ShoppingBag, AlertTriangle, Wallet, CheckCircle2, CalendarIcon, Beaker, Plus, Trash2, UserPlus, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import CondicoesPagamentoForm, { validarCondicoesPagamento } from './CondicoesPagamentoForm';
import { ESTADOS_CIVIS, UFS_BRASIL, fetchCidadesPorUF, fetchEnderecoPorCEP, getOpcoesPote, getOpcoesTampa } from '@/lib/brasilData';
import { validarCPF, validarCNPJ, validarEmail } from '@/lib/validators';
import { DateNumericInput, buildDate } from '@/components/ui/date-numeric-input';
import { cadastrarClienteVhSys, type CadastrarVhSysResult } from '@/lib/vhsysCliente';
import { toast as sonnerToast } from 'sonner';

interface AprovacaoOrcamentoDialogProps {
  orcamento: Orcamento;
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_PF: PessoaFisicaResponsavel = {
  nome: '', cpf: '', rg: '', endereco: '', cep: '', cidade: '', estado: '', telefone: '', email: '', estado_civil: '',
};

function PessoaFisicaFields({ pessoa, onChange, label, required = true }: { pessoa: PessoaFisicaResponsavel; onChange: (p: PessoaFisicaResponsavel) => void; label: string; required?: boolean }) {
  const update = (field: keyof PessoaFisicaResponsavel, value: string) => onChange({ ...pessoa, [field]: value });
  const [cidadesPF, setCidadesPF] = useState<string[]>([]);
  const [loadingCidadesPF, setLoadingCidadesPF] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [cpfError, setCpfError] = useState('');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (pessoa.estado && pessoa.estado.length === 2) {
      setLoadingCidadesPF(true);
      fetchCidadesPorUF(pessoa.estado).then(c => { setCidadesPF(c); setLoadingCidadesPF(false); });
    } else {
      setCidadesPF([]);
    }
  }, [pessoa.estado]);

  // CEP auto-fill
  useEffect(() => {
    const cepNums = (pessoa.cep || '').replace(/\D/g, '');
    if (cepNums.length === 8) {
      setLoadingCep(true);
      fetchEnderecoPorCEP(cepNums).then(result => {
        if (result) {
          onChange({ ...pessoa, endereco: result.logradouro || pessoa.endereco, cidade: result.cidade, estado: result.estado });
        }
        setLoadingCep(false);
      });
    }
  }, [pessoa.cep]);

  const handleCpfBlur = () => {
    if (pessoa.cpf && pessoa.cpf.replace(/\D/g, '').length > 0 && !validarCPF(pessoa.cpf)) {
      setCpfError('CPF inválido');
    } else {
      setCpfError('');
    }
  };

  const handleEmailBlur = () => {
    if (pessoa.email && pessoa.email.trim() && !validarEmail(pessoa.email)) {
      setEmailError('Email inválido');
    } else {
      setEmailError('');
    }
  };

  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome {required && <span className="text-destructive">*</span>}</Label>
          <Input value={pessoa.nome || ''} onChange={(e) => update('nome', e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CPF {required && <span className="text-destructive">*</span>}</Label>
          <Input value={pessoa.cpf || ''} onChange={(e) => update('cpf', e.target.value)} onBlur={handleCpfBlur} placeholder="000.000.000-00" className={cpfError ? 'border-destructive' : ''} />
          {cpfError && <p className="text-[10px] text-destructive">{cpfError}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">RG {required && <span className="text-destructive">*</span>}</Label>
          <Input value={pessoa.rg || ''} onChange={(e) => update('rg', e.target.value)} placeholder="RG" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado Civil {required && <span className="text-destructive">*</span>}</Label>
          <Select value={pessoa.estado_civil || ''} onValueChange={(v) => update('estado_civil', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {ESTADOS_CIVIS.map(ec => <SelectItem key={ec} value={ec}>{ec}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Endereço {required && <span className="text-destructive">*</span>}</Label>
          <Input value={pessoa.endereco || ''} onChange={(e) => update('endereco', e.target.value)} placeholder="Rua, número, bairro" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CEP {required && <span className="text-destructive">*</span>}{loadingCep && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}</Label>
          <Input value={pessoa.cep || ''} onChange={(e) => update('cep', e.target.value)} placeholder="00000-000" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado {required && <span className="text-destructive">*</span>}</Label>
          <Select value={pessoa.estado || ''} onValueChange={(v) => { onChange({ ...pessoa, estado: v, cidade: '' }); }}>
            <SelectTrigger><SelectValue placeholder="Selecione UF" /></SelectTrigger>
            <SelectContent>
              {UFS_BRASIL.map(u => <SelectItem key={u.uf} value={u.uf}>{u.uf} — {u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cidade {required && <span className="text-destructive">*</span>}</Label>
          <Input value={pessoa.cidade || ''} onChange={(e) => update('cidade', e.target.value)} placeholder={loadingCidadesPF ? 'Carregando...' : 'Cidade'} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Telefone {required && <span className="text-destructive">*</span>}</Label>
          <Input value={pessoa.telefone || ''} onChange={(e) => update('telefone', e.target.value)} placeholder="(00) 00000-0000" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Email {required && <span className="text-destructive">*</span>}</Label>
          <Input type="email" value={pessoa.email || ''} onChange={(e) => update('email', e.target.value)} onBlur={handleEmailBlur} placeholder="email@exemplo.com" className={emailError ? 'border-destructive' : ''} />
          {emailError && <p className="text-[10px] text-destructive">{emailError}</p>}
        </div>
      </div>
    </div>
  );
}

function validatePF(pf: PessoaFisicaResponsavel, label: string): string[] {
  const missing: string[] = [];
  if (!pf.nome?.trim()) missing.push(`Nome (${label})`);
  if (!pf.cpf?.trim()) missing.push(`CPF (${label})`);
  else if (!validarCPF(pf.cpf)) missing.push(`CPF inválido (${label})`);
  if (!pf.rg?.trim()) missing.push(`RG (${label})`);
  if (!pf.endereco?.trim()) missing.push(`Endereço (${label})`);
  if (!pf.cep?.trim()) missing.push(`CEP (${label})`);
  if (!pf.cidade?.trim()) missing.push(`Cidade (${label})`);
  if (!pf.estado?.trim()) missing.push(`Estado (${label})`);
  if (!pf.telefone?.trim()) missing.push(`Telefone (${label})`);
  if (!pf.email?.trim()) missing.push(`Email (${label})`);
  else if (!validarEmail(pf.email)) missing.push(`Email inválido (${label})`);
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
  const { updateDadosCliente, updateDetalhamentoFrete, updateOrcamento, updateStatus, definirNumeroAoPagar } = useOrcamentos({ enabled: false });
  const { createPedidoFromOrcamento, registrarVhsysAsync } = usePedidos({ enabled: false });
  const { atualizarCliente, criarCliente, buscarPorTelefone, buscarPorId } = useClientes();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);

  // Modal pós-confirmação de pagamento (oferece cadastro no VhSys)
  const [showVhsysModal, setShowVhsysModal] = useState(false);
  const [vhsysLoading, setVhsysLoading] = useState(false);
  const [vhsysResultado, setVhsysResultado] = useState<CadastrarVhSysResult | null>(null);
  const [pedidoIdAprovacao, setPedidoIdAprovacao] = useState<string | null>(null);

  // Data de pagamento (inputs numéricos DD/MM/AAAA)
  const dataInicial = orcamento.data_pagamento ? new Date(orcamento.data_pagamento) : null;
  const [diaPg, setDiaPg] = useState<string>(dataInicial ? String(dataInicial.getDate()).padStart(2, '0') : '');
  const [mesPg, setMesPg] = useState<string>(dataInicial ? String(dataInicial.getMonth() + 1).padStart(2, '0') : '');
  const [anoPg, setAnoPg] = useState<string>(dataInicial ? String(dataInicial.getFullYear()) : '');
  const dataPagamento: Date | null = buildDate(diaPg, mesPg, anoPg);
  const dataPagamentoFutura = !!dataPagamento && dataPagamento > new Date();
  const dataPagamentoValida = !!dataPagamento && !dataPagamentoFutura;

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

  // Marca (opcional) — vinculada à razão social ao confirmar
  const [marca, setMarca] = useState<string>('');

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
  const [erroValidacao, setErroValidacao] = useState<string[]>([]);
  const cnpjBuscadoRef = useRef<string>('');

  useEffect(() => {
    if (orcamento.dados_cliente && !clienteSelecionado) {
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

  // Pre-load client from orcamento.cliente_id
  useEffect(() => {
    if (orcamento.cliente_id && !clienteSelecionado) {
      buscarPorId(orcamento.cliente_id).then(cliente => {
        if (cliente) {
          handleClienteSelect(cliente);
        }
      }).catch(err => console.error('Erro ao carregar cliente:', err));
    }
  }, [orcamento.cliente_id]);

  const handleClienteSelect = (cliente: Cliente) => {
    setClienteSelecionado(cliente);
    setTipoPessoa(cliente.tipo_pessoa as 'pj' | 'pf' || 'pj');
    setDadosCliente(prev => ({
      ...prev,
      tipo_pessoa: cliente.tipo_pessoa as 'pj' | 'pf',
      cnpj: cliente.cnpj || prev.cnpj,
      razao_social: cliente.razao_social || prev.razao_social,
      inscricao_municipal: cliente.inscricao_municipal || prev.inscricao_municipal,
      inscricao_estadual: cliente.inscricao_estadual || prev.inscricao_estadual,
      endereco_cnpj: cliente.endereco_cnpj || prev.endereco_cnpj,
      cep_cnpj: cliente.cep_cnpj || prev.cep_cnpj,
      cidade: cliente.cidade_cnpj || cliente.cidade || prev.cidade,
      estado: cliente.estado_cnpj || cliente.estado || prev.estado,
      telefone: cliente.telefone_cnpj || cliente.telefone || prev.telefone,
      email: cliente.email_cnpj || cliente.email || prev.email,
    }));
    if (cliente.responsavel_pj && typeof cliente.responsavel_pj === 'object' && Object.keys(cliente.responsavel_pj).length > 0) {
      setResponsavelPJ(cliente.responsavel_pj as PessoaFisicaResponsavel);
    }
    if (Array.isArray(cliente.pessoas_fisicas) && cliente.pessoas_fisicas.length > 0) {
      setPessoasFisicas(cliente.pessoas_fisicas as PessoaFisicaResponsavel[]);
    }
    if (cliente.marca) setMarca(cliente.marca);
  };

  // Auto-set frete when envio tipo changes
  useEffect(() => {
    if (detalhamentoEnvio.tipo === 'total_produtor') {
      setFreteLemonCaps(false);
    }
  }, [detalhamentoEnvio.tipo]);

  // Auto-select single-option production details
  useEffect(() => {
    orcamento.itens_producao.forEach((item, idx) => {
      const seg = (item.segmento || '').toLowerCase();
      const opcoesPote = getOpcoesPote(seg);
      const opcoesTampa = getOpcoesTampa(seg);
      const current = detalhesProducao[idx] || {};
      let changed = false;
      const updated = { ...current };
      if (opcoesPote.length === 1 && !current.cor_pote) { updated.cor_pote = opcoesPote[0]; changed = true; }
      if (opcoesTampa.length === 1 && !current.cor_tampa) { updated.cor_tampa = opcoesTampa[0]; changed = true; }
      if (changed) {
        setDetalhesProducao(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), ...updated } }));
      }
    });
  }, [orcamento.itens_producao]);

  // CEP auto-fill for PJ
  useEffect(() => {
    const cepNums = (dadosCliente.cep_cnpj || '').replace(/\D/g, '');
    if (cepNums.length === 8) {
      fetchEnderecoPorCEP(cepNums).then(result => {
        if (result) {
          setDadosCliente(prev => ({
            ...prev,
            endereco_cnpj: result.logradouro || prev.endereco_cnpj,
            cidade: result.cidade,
            estado: result.estado,
          }));
        }
      });
    }
  }, [dadosCliente.cep_cnpj]);

  const handleBuscarCnpj = async () => {
    const cnpj = dadosCliente.cnpj?.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) return;
    cnpjBuscadoRef.current = cnpj;
    setIsSearchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (response.ok) {
        const data = await response.json();
        // Montar endereço robusto: "Rua, Num, Complemento - Bairro"
        const parteLogradouro = [data.logradouro, data.numero, data.complemento].filter(Boolean).join(', ');
        const enderecoCompleto = parteLogradouro && data.bairro
          ? `${parteLogradouro} - ${data.bairro}`
          : parteLogradouro || data.bairro || '';
        setDadosCliente(prev => ({
          ...prev,
          razao_social: data.razao_social || '',
          endereco_cnpj: enderecoCompleto,
          cep_cnpj: data.cep ? data.cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2') : '',
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

  // Busca automática de CNPJ ao completar 14 dígitos
  useEffect(() => {
    const cnpj = (dadosCliente.cnpj || '').replace(/\D/g, '');
    if (cnpj.length === 14 && cnpj !== cnpjBuscadoRef.current && !isSearchingCnpj) {
      handleBuscarCnpj();
    }
  }, [dadosCliente.cnpj]);

  const handleConfirmAprovacao = async () => {
    const camposFaltando: string[] = [];

    // Validate client based on tipo_pessoa
    if (tipoPessoa === 'pj') {
      if (!dadosCliente.cnpj?.trim()) camposFaltando.push('CNPJ');
      else if (!validarCNPJ(dadosCliente.cnpj)) camposFaltando.push('CNPJ inválido');
      if (!dadosCliente.razao_social?.trim()) camposFaltando.push('Razão Social');
      if (!dadosCliente.endereco_cnpj?.trim()) camposFaltando.push('Endereço');
      if (!dadosCliente.cep_cnpj?.trim()) camposFaltando.push('CEP');
      if (!dadosCliente.cidade?.trim()) camposFaltando.push('Cidade');
      if (!dadosCliente.estado?.trim()) camposFaltando.push('Estado');
      if (!dadosCliente.telefone?.trim()) camposFaltando.push('Telefone');
      if (!dadosCliente.email?.trim()) camposFaltando.push('Email');
      else if (!validarEmail(dadosCliente.email)) camposFaltando.push('Email inválido');
      // Validate responsável PJ (QSA)
      // QSA não é obrigatório no fluxo Pago (apenas no Resumo para Contrato)
    } else {
      // PF
      pessoasFisicas.forEach((pf, i) => {
        camposFaltando.push(...validatePF(pf, `Pessoa Física ${i + 1}`));
      });
    }

    // Detalhes de produção são opcionais — não validar.

    if (!dataPagamentoValida) {
      camposFaltando.push(dataPagamentoFutura ? 'Data de Pagamento (não pode ser futura)' : 'Data de Pagamento');
    }

    // Detalhamento do frete obrigatório
    if (!detalhamentoEnvio.tipo) {
      camposFaltando.push('Detalhamento de Frete (tipo de logística)');
    } else if (detalhamentoEnvio.tipo === 'parcial' && !detalhamentoEnvio.descricao_parcial?.trim()) {
      camposFaltando.push('Descrição do envio parcial');
    }

    const erros = validarCondicoesPagamento(condicoesPagamento, orcamento.valor_total);
    if (erros.length > 0) {
      setErrosPagamento(erros);
      camposFaltando.push(...erros.map((e) => `Condições de Pagamento: ${e}`));
    } else {
      setErrosPagamento([]);
    }

    if (camposFaltando.length > 0) {
      setErroValidacao(camposFaltando);
      const { toast } = await import('@/hooks/use-toast');
      toast({
        title: 'Campos obrigatórios não preenchidos',
        description: camposFaltando.join(', '),
        variant: 'destructive',
      });
      return;
    }

    setErroValidacao([]);

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

      // Persistir cliente na tabela centralizada
      const clienteData = {
        nome: tipoPessoa === 'pj' ? (dadosCliente.razao_social || orcamento.nome_cliente) : (pessoasFisicas[0]?.nome || orcamento.nome_cliente),
        telefone: clienteSelecionado?.telefone || dadosCliente.telefone || pessoasFisicas[0]?.telefone || '',
        tipo_pessoa: tipoPessoa,
        razao_social: dadosCliente.razao_social,
        cnpj: dadosCliente.cnpj,
        cpf: tipoPessoa === 'pf' ? pessoasFisicas[0]?.cpf : undefined,
        rg: tipoPessoa === 'pf' ? pessoasFisicas[0]?.rg : undefined,
        email: dadosCliente.email || pessoasFisicas[0]?.email,
        endereco_cnpj: dadosCliente.endereco_cnpj,
        cep_cnpj: dadosCliente.cep_cnpj,
        cidade_cnpj: dadosCliente.cidade,
        estado_cnpj: dadosCliente.estado,
        telefone_cnpj: dadosCliente.telefone,
        email_cnpj: dadosCliente.email,
        inscricao_estadual: dadosCliente.inscricao_estadual,
        inscricao_municipal: dadosCliente.inscricao_municipal,
        forma_venda: formaVenda,
        responsavel_pj: tipoPessoa === 'pj' ? responsavelPJ : undefined,
        pessoas_fisicas: tipoPessoa === 'pf' ? pessoasFisicas : undefined,
        ...(marca.trim() ? { marca: marca.trim() } : {}),
      };

      let clienteIdFinal: string | undefined;
      const telefoneContato = clienteSelecionado?.telefone || clienteData.telefone;

      try {
        if (clienteSelecionado) {
          await atualizarCliente.mutateAsync({ id: clienteSelecionado.id, ...clienteData });
          clienteIdFinal = clienteSelecionado.id;
        } else if (telefoneContato) {
          const existente = await buscarPorTelefone(telefoneContato);
          if (existente) {
            await atualizarCliente.mutateAsync({ id: existente.id, ...clienteData });
            clienteIdFinal = existente.id;
          } else {
            const novo = await criarCliente.mutateAsync({ ...clienteData, telefone: telefoneContato });
            clienteIdFinal = novo.id;
          }
        }

        if (clienteIdFinal) {
          await supabase
            .from('orcamentos')
            .update({ cliente_id: clienteIdFinal })
            .eq('id', orcamento.id);
        }
      } catch (err: any) {
        console.error('Erro ao salvar cliente:', err);
        const { toast } = await import('@/hooks/use-toast');
        toast({
          title: 'Erro ao salvar cliente',
          description: err?.message || 'Erro desconhecido',
          variant: 'destructive',
        });
      }

      await updateStatus.mutateAsync({
        id: orcamento.id,
        status: 'pago',
        data_pagamento: dataPagamento!.toISOString(),
      });

      // So' agora da' para numerar: a sequencia do cliente conta apenas os pagos.
      // Tem que vir antes do pedido, senao o snapshot carregaria o numero velho.
      let numeroDefinitivo = orcamento.numero_orcamento;
      try {
        numeroDefinitivo = await definirNumeroAoPagar({
          id: orcamento.id,
          clienteId: (orcamento as any).cliente_id,
          nomeCliente: orcamento.nome_cliente,
          numeroAtual: orcamento.numero_orcamento,
        });
      } catch (err: any) {
        // Numeracao nao pode barrar a aprovacao: o pedido segue com o numero atual.
        console.error('Erro ao definir o número do orçamento:', err);
        sonnerToast.error('Não foi possível gerar o número definitivo; o orçamento manteve o número atual.');
      }

      const orcamentoCompleto = {
        ...orcamento,
        numero_orcamento: numeroDefinitivo,
        itens_producao: itensComDetalhes,
        dados_cliente: dadosClienteCompletos,
        detalhamento_frete: detalhamentoFrete,
        condicoes_pagamento: condicoesPagamento,
        data_pagamento: dataPagamento!.toISOString(),
      };

      const pedidoCriado = await createPedidoFromOrcamento(orcamentoCompleto);
      const pedidoIdCriado: string | undefined = (pedidoCriado as any)?.id;

      // Cadastro automático no VhSys; popup informativo será exibido com o resultado.
      setShowVhsysModal(true);
      setVhsysLoading(true);
      try {
        const result = await cadastrarClienteVhSys({
          orcamento, tipoPessoa, dadosCliente, pessoasFisicas, responsavelPJ,
        });
        setVhsysResultado(result);
        if (result.success) sonnerToast.success('Cliente cadastrado automaticamente no VhSys');
        else sonnerToast.error(result.error || 'Falha ao cadastrar cliente no VhSys');
        if (pedidoIdCriado) {
          try {
            await registrarVhsysAsync({
              pedidoId: pedidoIdCriado,
              entry: {
                data: new Date().toISOString(),
                sucesso: !!result.success,
                mensagem: result.success
                  ? `Cliente "${dadosCliente.nome_completo || dadosCliente.razao_social || orcamento.nome_cliente}" cadastrado no VhSys.`
                  : (result.error || 'Falha ao cadastrar cliente no VhSys.'),
                origem: 'aprovacao_pagamento',
                payload: result.payload,
                resposta: (result as any).data ?? null,
              },
            });
          } catch (e) { console.error('Falha ao registrar histórico VhSys', e); }
          setPedidoIdAprovacao(pedidoIdCriado);
        }
      } finally {
        setVhsysLoading(false);
      }
    } catch (error) {
      console.error('Erro ao aprovar orçamento:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryVhSys = async () => {
    setVhsysLoading(true);
    try {
      const result = await cadastrarClienteVhSys({
        orcamento, tipoPessoa, dadosCliente, pessoasFisicas, responsavelPJ,
      });
      setVhsysResultado(result);
      if (result.success) sonnerToast.success('Cliente cadastrado no VhSys');
      else sonnerToast.error(result.error || 'Falha ao cadastrar cliente no VhSys');
      if (pedidoIdAprovacao) {
        try {
          await registrarVhsysAsync({
            pedidoId: pedidoIdAprovacao,
            entry: {
              data: new Date().toISOString(),
              sucesso: !!result.success,
              mensagem: result.success
                ? `Reenvio: cliente cadastrado no VhSys.`
                : (result.error || 'Reenvio: falha ao cadastrar cliente no VhSys.'),
              origem: 'manual',
              payload: result.payload,
              resposta: (result as any).data ?? null,
            },
          });
        } catch (e) { console.error('Falha ao registrar histórico VhSys', e); }
      }
    } finally {
      setVhsysLoading(false);
    }
  };

  const handleFecharPosPagamento = () => {
    setShowVhsysModal(false);
    onSuccess();
    onClose();
  };

  if (showVhsysModal) {
    const success = vhsysResultado?.success === true;
    const payload = vhsysResultado?.payload || {};
    const nomeCliente = (payload.nome as string) || orcamento.nome_cliente;
    const camposResumo: Array<[string, any]> = [
      ['Nome / Razão social', payload.nome],
      ['Nome fantasia', payload.nome_fantasia],
      ['Tipo', payload.tipo_pessoa === 'J' ? 'Pessoa Jurídica' : payload.tipo_pessoa === 'F' ? 'Pessoa Física' : undefined],
      ['CNPJ / CPF', payload.cnpj_cpf],
      ['Inscrição estadual', payload.inscricao_estadual],
      ['Inscrição municipal', payload.inscricao_municipal],
      ['E-mail', payload.email],
      ['Telefone', payload.telefone],
      ['CEP', payload.cep],
      ['Logradouro', payload.logradouro],
      ['Número', payload.numero],
      ['Bairro', payload.bairro],
      ['Cidade', payload.cidade],
      ['UF', payload.uf],
      ['Contato', payload.contato],
    ];
    return (
      <Dialog open onOpenChange={(open) => { if (!open) handleFecharPosPagamento(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {vhsysLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" />Cadastrando cliente no VhSys...</>
              ) : success ? (
                <><CheckCircle2 className="w-5 h-5 text-green-600" />Cliente cadastrado no VhSys</>
              ) : (
                <><AlertTriangle className="w-5 h-5 text-destructive" />Falha ao cadastrar no VhSys</>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {vhsysLoading
                ? 'O pedido foi criado e estamos cadastrando o cliente no VhSys automaticamente...'
                : success
                  ? `O cliente "${nomeCliente}" foi gerado automaticamente no VhSys com os dados abaixo.`
                  : 'O pedido foi criado, mas o cadastro automático do cliente no VhSys falhou.'}
            </p>

            {!vhsysLoading && !success && vhsysResultado?.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{vhsysResultado.error}</AlertDescription>
              </Alert>
            )}

            {!vhsysLoading && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Resumo dos dados {success ? 'enviados ao VhSys' : 'que seriam enviados'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {camposResumo
                    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
                    .map(([label, v]) => (
                      <div key={label} className="flex flex-col">
                        <span className="text-[11px] text-muted-foreground">{label}</span>
                        <span className="text-foreground break-words">{String(v)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {!vhsysLoading && !success && (
              <Button variant="outline" onClick={handleRetryVhSys} disabled={vhsysLoading}>
                <UserPlus className="w-4 h-4 mr-2" />Tentar novamente
              </Button>
            )}
            <Button onClick={handleFecharPosPagamento} disabled={vhsysLoading}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
              {/* Buscar Cliente Existente */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Buscar Cliente Existente</Label>
                <ClienteSelector
                  modo="completo"
                  clienteSelecionado={clienteSelecionado}
                  onSelect={handleClienteSelect}
                  onClear={() => setClienteSelecionado(null)}
                  onNovo={() => {
                    setClienteSelecionado(null);
                    setTipoPessoa('pj');
                    setDadosCliente({
                      tipo_pessoa: 'pj',
                      cnpj: '', razao_social: '', inscricao_municipal: '', inscricao_estadual: '',
                      endereco_cnpj: '', cep_cnpj: '', cidade: '', estado: '', telefone: '', email: '',
                    });
                    setResponsavelPJ({ ...EMPTY_PF });
                    setPessoasFisicas([{ ...EMPTY_PF }]);
                  }}
                />
              </div>

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
                      {isSearchingCnpj && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Buscando dados do CNPJ...
                        </p>
                      )}
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
                      <Select value={dadosCliente.estado || ''} onValueChange={(v) => { setDadosCliente(prev => ({ ...prev, estado: v })); }}>
                        <SelectTrigger><SelectValue placeholder="Selecione UF" /></SelectTrigger>
                        <SelectContent>
                          {UFS_BRASIL.map(u => <SelectItem key={u.uf} value={u.uf}>{u.uf} — {u.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cidade <span className="text-destructive">*</span></Label>
                      <Input value={dadosCliente.cidade || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, cidade: e.target.value }))} placeholder="Cidade" />
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
                    required={false}
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
                2. Detalhes do Produto <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
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
                              <Label className="text-xs">Cor da Tampa</Label>
                              <Select value={d.cor_tampa || (opcoesTampa.length === 1 ? opcoesTampa[0] : '')} onValueChange={(v) => updateDetalhe(idx, 'cor_tampa', v)}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  {opcoesTampa.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Cor do Pote</Label>
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
                            <Label className="text-xs">Sabor</Label>
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
                            <Label className="text-xs">Cor do Conteúdo</Label>
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
                            <Label className="text-xs">Sabor</Label>
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
                            <Label className="text-xs">Cor do Conteúdo</Label>
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
                            <Label className="text-xs">Sabor</Label>
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
                            <Label className="text-xs">Cor do Conteúdo</Label>
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
                          <Label className="text-xs">Observação de Produção</Label>
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
                <span className="text-xs text-destructive font-normal">(obrigatório)</span>
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
                      <Label htmlFor="aprov-produtor" className="font-normal cursor-pointer text-sm">
                        Enviar produção completa para o Produtor, Lemon Caps fará a logística enviando para cliente final.
                      </Label>
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
                    <Label className="text-xs text-muted-foreground">Descreva a divisão: <span className="text-destructive">*</span></Label>
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
                      Produção completa entregue ao Produtor; a Lemon Caps cuidará da logística até o cliente final.
                  </p>
                )}
              </div>
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
          <Card className={!dataPagamentoValida ? 'border-destructive' : 'border-green-500'}>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                6. Data do Pagamento do Cliente
                <span className="text-xs text-destructive font-normal">(obrigatório)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <DateNumericInput
                  dia={diaPg}
                  mes={mesPg}
                  ano={anoPg}
                  onChange={(d, m, a) => { setDiaPg(d); setMesPg(m); setAnoPg(a); }}
                />
                {dataPagamento && (
                  <p className="text-xs text-muted-foreground">
                    {format(dataPagamento, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                )}
                {dataPagamentoFutura && (
                  <p className="text-xs text-destructive">A data de pagamento não pode ser futura.</p>
                )}
                {!dataPagamento && (diaPg || mesPg || anoPg) && (
                  <p className="text-xs text-destructive">Data inválida — preencha dia, mês e ano (4 dígitos).</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 7. Marca (opcional) */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="w-4 h-4" />
                7. Marca
                <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <Label className="text-xs">
                  Nome da marca vinculada à razão social
                </Label>
                <Input
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ex.: Lemon Naturals"
                />
                <p className="text-[10px] text-muted-foreground">
                  Se preenchido, a marca aparece na lista de pedidos ao lado da razão social.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {erroValidacao.length > 0 && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-1">Corrija os campos abaixo antes de confirmar:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                {erroValidacao.map((e, i) => (<li key={i}>{e}</li>))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirmAprovacao}
            disabled={!dataPagamentoValida || isSubmitting}
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
