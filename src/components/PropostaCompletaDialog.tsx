import { useState, useEffect } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { Orcamento, DadosCliente, DetalhamentoFrete, DetalhamentoEnvio, CondicoesPagamento, PessoaFisicaResponsavel } from '@/types/orcamento';
import { generateOrcamentoPDFBlob, generateOrcamentoPDF } from '@/lib/orcamentoGenerator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ClienteSelector from '@/components/ClienteSelector';
import { useClientes, Cliente } from '@/hooks/useClientes';
import { useResumoContrato, useSalvarResumoContrato, baixarPdfContrato } from '@/hooks/useResumoContrato';
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
import { Loader2, User, Truck, Download, PackageCheck, Search, ShoppingBag, AlertTriangle, Wallet, Beaker, Plus, Trash2, UserPlus } from 'lucide-react';
import CondicoesPagamentoForm, { validarCondicoesPagamento } from './CondicoesPagamentoForm';
import { ESTADOS_CIVIS, UFS_BRASIL, fetchCidadesPorUF, fetchEnderecoPorCEP, getOpcoesPote, getOpcoesTampa } from '@/lib/brasilData';
import { validarCPF, validarCNPJ, validarEmail } from '@/lib/validators';

interface PropostaCompletaDialogProps {
  orcamento: Orcamento;
  onClose: () => void;
  modo?: 'editar' | 'visualizar';
}

const EMPTY_PF: PessoaFisicaResponsavel = {
  nome: '', cpf: '', rg: '', endereco: '', cep: '', cidade: '', estado: '', telefone: '', email: '', estado_civil: '',
};

function PessoaFisicaFields({ pessoa, onChange, label }: { pessoa: PessoaFisicaResponsavel; onChange: (p: PessoaFisicaResponsavel) => void; label: string }) {
  const update = (field: keyof PessoaFisicaResponsavel, value: string) => onChange({ ...pessoa, [field]: value });
  const [loadingCep, setLoadingCep] = useState(false);
  const [cpfError, setCpfError] = useState('');
  const [emailError, setEmailError] = useState('');

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
          <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
          <Input value={pessoa.nome || ''} onChange={(e) => update('nome', e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CPF <span className="text-destructive">*</span></Label>
          <Input value={pessoa.cpf || ''} onChange={(e) => update('cpf', e.target.value)} onBlur={handleCpfBlur} placeholder="000.000.000-00" className={cpfError ? 'border-destructive' : ''} />
          {cpfError && <p className="text-[10px] text-destructive">{cpfError}</p>}
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
          <Label className="text-xs">CEP <span className="text-destructive">*</span>{loadingCep && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}</Label>
          <Input value={pessoa.cep || ''} onChange={(e) => update('cep', e.target.value)} placeholder="00000-000" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado <span className="text-destructive">*</span></Label>
          <Select value={pessoa.estado || ''} onValueChange={(v) => { onChange({ ...pessoa, estado: v, cidade: '' }); }}>
            <SelectTrigger><SelectValue placeholder="Selecione UF" /></SelectTrigger>
            <SelectContent>
              {UFS_BRASIL.map(u => <SelectItem key={u.uf} value={u.uf}>{u.uf} — {u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cidade <span className="text-destructive">*</span></Label>
          <Input value={pessoa.cidade || ''} onChange={(e) => update('cidade', e.target.value)} placeholder="Cidade" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Telefone <span className="text-destructive">*</span></Label>
          <Input value={pessoa.telefone || ''} onChange={(e) => update('telefone', e.target.value)} placeholder="(00) 00000-0000" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
          <Input type="email" value={pessoa.email || ''} onChange={(e) => update('email', e.target.value)} onBlur={handleEmailBlur} placeholder="email@exemplo.com" className={emailError ? 'border-destructive' : ''} />
          {emailError && <p className="text-[10px] text-destructive">{emailError}</p>}
        </div>
      </div>
    </div>
  );
}

export default function PropostaCompletaDialog({ orcamento, onClose, modo = 'editar' }: PropostaCompletaDialogProps) {
  const { updateDadosCliente, updateDetalhamentoFrete, updateOrcamento } = useOrcamentos();
  const { atualizarCliente, criarCliente, buscarPorTelefone, buscarPorId } = useClientes();
  const { data: resumoSalvo, isLoading: loadingResumo } = useResumoContrato(orcamento.id);
  const salvarResumoMutation = useSalvarResumoContrato();
  const [viewMode, setViewMode] = useState<'editar' | 'visualizar'>(modo);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

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

  // VhSys: estado do botão de cadastro
  const [vhsysLoading, setVhsysLoading] = useState(false);

  const handleCadastrarVhSys = async () => {
    const pf = pessoasFisicas[0];
    const contato = tipoPessoa === 'pj'
      ? (responsavelPJ.nome || pf?.nome || '').trim()
      : (pf?.nome || '').trim();
    const nomeFinal = (
      tipoPessoa === 'pj'
        ? (dadosCliente.razao_social || orcamento.nome_cliente)
        : (pf?.nome || orcamento.nome_cliente)
    )?.trim();

    const cnpjCpf = (
      tipoPessoa === 'pj' ? dadosCliente.cnpj : pf?.cpf
    )?.trim();

    if (!nomeFinal) {
      toast.error('Informe o nome (ou razão social) do cliente.');
      return;
    }
    if (!cnpjCpf) {
      toast.error(tipoPessoa === 'pj' ? 'Informe o CNPJ do cliente.' : 'Informe o CPF do cliente.');
      return;
    }

    const email =
      tipoPessoa === 'pj' ? (dadosCliente.email || pf?.email) : (pf?.email || dadosCliente.email);
    const telefone =
      tipoPessoa === 'pj' ? (dadosCliente.telefone || pf?.telefone) : (pf?.telefone || dadosCliente.telefone);
    const cep = tipoPessoa === 'pj' ? (dadosCliente.cep_cnpj || pf?.cep) : (pf?.cep || dadosCliente.cep_cnpj);
    const logradouro =
      tipoPessoa === 'pj' ? (dadosCliente.endereco_cnpj || pf?.endereco) : (pf?.endereco || dadosCliente.endereco_cnpj);
    const cidade = tipoPessoa === 'pj' ? (dadosCliente.cidade || pf?.cidade) : (pf?.cidade || dadosCliente.cidade);
    const uf = tipoPessoa === 'pj' ? (dadosCliente.estado || pf?.estado) : (pf?.estado || dadosCliente.estado);
    const enderecoBruto = (logradouro || '').trim();
    const enderecoPartes = enderecoBruto.split(',').map((parte) => parte.trim()).filter(Boolean);
    const numeroDetectado = enderecoPartes.length > 1 ? enderecoPartes[1] : undefined;
    const logradouroDetectado = enderecoPartes[0] || undefined;
    const bairroDetectado = enderecoBruto.includes(' - ')
      ? enderecoBruto.split(' - ').pop()?.trim()
      : undefined;

    // Monta observação com produtos do orçamento
    const linhasProdutos = (orcamento.itens_producao || [])
      .map((item) => {
        const nome = (item.nome_produto || '').trim();
        if (!nome) return null;
        const qtd = item.quantidade ?? 0;
        const seg = item.segmento ? ` [${item.segmento}]` : '';
        return `• ${nome}${seg} - Qtd: ${qtd}`;
      })
      .filter(Boolean) as string[];
    const observacaoProdutos = linhasProdutos.length
      ? `Produtos do orçamento ${orcamento.numero_orcamento || ''}:\n${linhasProdutos.join('\n')}`.trim()
      : undefined;

    setVhsysLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('vhsys-create-cliente', {
        body: {
          nome: nomeFinal,
          nome_fantasia: tipoPessoa === 'pj'
            ? (dadosCliente.razao_social || nomeFinal)
            : nomeFinal,
          tipo_pessoa: tipoPessoa === 'pj' ? 'J' : 'F',
          cnpj_cpf: cnpjCpf,
          email: email || undefined,
          telefone: telefone || undefined,
          cep: cep || undefined,
          logradouro: logradouroDetectado || logradouro || undefined,
          numero: numeroDetectado || undefined,
          bairro: bairroDetectado || undefined,
          cidade: cidade || undefined,
          uf: uf || undefined,
          contato: contato || undefined,
          inscricao_estadual: tipoPessoa === 'pj' ? (dadosCliente.inscricao_estadual || undefined) : undefined,
          inscricao_municipal: tipoPessoa === 'pj' ? (dadosCliente.inscricao_municipal || undefined) : undefined,
          observacao: observacaoProdutos,
        },
      });

      if (error) {
        const ctx: any = (error as any).context;
        let serverMsg: string | undefined;
        try {
          const parsed = ctx?.body ? JSON.parse(ctx.body) : null;
          serverMsg = parsed?.error || parsed?.message;
        } catch { /* ignore */ }
        toast.error(serverMsg || error.message || 'Falha ao cadastrar cliente no VhSys.');
        return;
      }

      if ((data as any)?.error) {
        toast.error((data as any).error);
        return;
      }

      toast.success('Cliente cadastrado com sucesso no VhSys!');
    } catch (err) {
      toast.error((err as Error).message || 'Erro inesperado ao cadastrar no VhSys.');
    } finally {
      setVhsysLoading(false);
    }
  };

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

  useEffect(() => {
    if (orcamento.dados_cliente) {
      const dc = orcamento.dados_cliente;
      // Only fill form from dados_cliente if no client was loaded by ID
      if (!clienteSelecionado) {
        setDadosCliente(prev => ({ ...prev, ...dc }));
        setTipoPessoa(dc.tipo_pessoa || 'pj');
        setFormaVenda(dc.forma_venda || 'sem_informacao');
        if (dc.responsavel_pj) setResponsavelPJ(dc.responsavel_pj);
        if (dc.pessoas_fisicas && dc.pessoas_fisicas.length > 0) setPessoasFisicas(dc.pessoas_fisicas);
      }
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
    // Load existing production details
    const existingDetails: Record<number, Record<string, string>> = {};
    orcamento.itens_producao.forEach((item, idx) => {
      if (item.detalhes_producao) {
        existingDetails[idx] = item.detalhes_producao as unknown as Record<string, string>;
      }
    });
    if (Object.keys(existingDetails).length > 0) {
      setDetalhesProducao(prev => ({ ...prev, ...existingDetails }));
    }
  }, [orcamento]);

  // Sobrescrever pré-preenchimento com snapshot do resumo salvo (se existir)
  useEffect(() => {
    if (!resumoSalvo?.resumo) return;
    const r = resumoSalvo.resumo;
    if (r.dados_cliente) {
      const dc = r.dados_cliente;
      setDadosCliente(prev => ({ ...prev, ...dc }));
      if (dc.tipo_pessoa) setTipoPessoa(dc.tipo_pessoa);
      if (dc.forma_venda) setFormaVenda(dc.forma_venda);
      if (dc.responsavel_pj) setResponsavelPJ(dc.responsavel_pj);
      if (dc.pessoas_fisicas && dc.pessoas_fisicas.length > 0) setPessoasFisicas(dc.pessoas_fisicas);
    }
    if (r.detalhamento_frete) {
      setFreteLemonCaps(r.detalhamento_frete.frete_lemon_caps ?? true);
      setUsaTabelaTradicional(r.detalhamento_frete.usa_tabela_tradicional ?? true);
      if (r.detalhamento_frete.detalhamento_envio) {
        setDetalhamentoEnvio(r.detalhamento_frete.detalhamento_envio);
      }
    }
    if (r.condicoes_pagamento) {
      setCondicoesPagamento(r.condicoes_pagamento);
    }
    if (r.detalhes_producao && typeof r.detalhes_producao === 'object') {
      // Convert keys to numbers
      const dp: Record<number, Record<string, string>> = {};
      Object.entries(r.detalhes_producao).forEach(([k, v]) => { dp[Number(k)] = v as Record<string, string>; });
      setDetalhesProducao(dp);
    }
  }, [resumoSalvo?.resumo?.id]);

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
      telefone: cliente.telefone || prev.telefone,
      email: cliente.email || prev.email,
    }));
    if (cliente.responsavel_pj && Object.keys(cliente.responsavel_pj).length > 0) {
      setResponsavelPJ(cliente.responsavel_pj);
    }
    if (cliente.pessoas_fisicas && cliente.pessoas_fisicas.length > 0) {
      setPessoasFisicas(cliente.pessoas_fisicas);
    }
    setFormaVenda(cliente.forma_venda || 'sem_informacao');
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

  const handleGenerateProposta = async () => {
    // Validar condições de pagamento
    const erros = validarCondicoesPagamento(condicoesPagamento, orcamento.valor_total);
    if (erros.length > 0) {
      setErrosPagamento(erros);
      return;
    }
    setErrosPagamento([]);

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

      // Salvar dados no orçamento (sem mudar status, sem criar pedido)
      await updateDadosCliente.mutateAsync({ id: orcamento.id, dados_cliente: dadosClienteCompletos });
      await updateDetalhamentoFrete.mutateAsync({ id: orcamento.id, detalhamento_frete: detalhamentoFrete });
      await updateOrcamento.mutateAsync({
        id: orcamento.id,
        updates: { condicoes_pagamento: condicoesPagamento, itens_producao: itensComDetalhes },
      });

      // Persistir na tabela clientes
      const clienteData = {
        nome: tipoPessoa === 'pj' ? (dadosCliente.razao_social || orcamento.nome_cliente) : (pessoasFisicas[0]?.nome || orcamento.nome_cliente),
        telefone: dadosCliente.telefone || pessoasFisicas[0]?.telefone || '',
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
        inscricao_estadual: dadosCliente.inscricao_estadual,
        inscricao_municipal: dadosCliente.inscricao_municipal,
        forma_venda: formaVenda,
        responsavel_pj: tipoPessoa === 'pj' ? responsavelPJ : undefined,
        pessoas_fisicas: tipoPessoa === 'pf' ? pessoasFisicas : undefined,
      };

      try {
        let clienteIdFinal: string | undefined;
        // Use the original contact phone (from client or budget) for duplicate detection
        const telefoneContato = clienteSelecionado?.telefone || clienteData.telefone;

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

        // Save cliente_id back to orcamento
        if (clienteIdFinal) {
          await updateOrcamento.mutateAsync({
            id: orcamento.id,
            updates: { cliente_id: clienteIdFinal },
          });
        }
      } catch (err: any) {
        console.error('Erro ao salvar cliente:', err);
        toast.error('Erro ao salvar cliente: ' + (err?.message || 'erro desconhecido'));
      }

      // Gerar preview do PDF
      const orcamentoAtualizado: Orcamento = {
        ...orcamento,
        itens_producao: itensComDetalhes,
        dados_cliente: dadosClienteCompletos,
        detalhamento_frete: detalhamentoFrete,
        condicoes_pagamento: condicoesPagamento,
      };

      const blob = await generateOrcamentoPDFBlob(orcamentoAtualizado);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setShowPreview(true);

      // Salvar PDF + dados no storage/tabela (substitui versão anterior)
      try {
        await salvarResumoMutation.mutateAsync({
          orcamento: orcamentoAtualizado,
          dadosCliente: dadosClienteCompletos,
          detalhamentoFrete,
          condicoesPagamento,
          detalhesProducao,
          clienteId: clienteSelecionado?.id ?? orcamento.cliente_id ?? null,
          pdfBlob: blob,
        });
      } catch (err) {
        console.error('Erro ao salvar resumo no storage:', err);
      }
    } catch (error) {
      console.error('Erro ao gerar resumo para contrato:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    const dadosClienteCompletos: DadosCliente = {
      ...dadosCliente,
      tipo_pessoa: tipoPessoa,
      forma_venda: formaVenda as DadosCliente['forma_venda'],
      responsavel_pj: tipoPessoa === 'pj' ? responsavelPJ : undefined,
      pessoas_fisicas: tipoPessoa === 'pf' ? pessoasFisicas : undefined,
    };
    const itensComDetalhes = orcamento.itens_producao.map((item, idx) => ({
      ...item,
      detalhes_producao: detalhesProducao[idx] || undefined,
    }));
    const orcamentoAtualizado: Orcamento = {
      ...orcamento,
      itens_producao: itensComDetalhes,
      dados_cliente: dadosClienteCompletos,
      detalhamento_frete: {
        frete_lemon_caps: freteLemonCaps,
        usa_tabela_tradicional: usaTabelaTradicional,
        planos_customizados: orcamento.detalhamento_frete?.planos_customizados || [],
        detalhamento_envio: detalhamentoEnvio,
      },
      condicoes_pagamento: condicoesPagamento,
    };
    await generateOrcamentoPDF(orcamentoAtualizado);
    onClose();
  };

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  if (showPreview && pdfUrl) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview do Resumo para Contrato</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <iframe src={pdfUrl} className="w-full h-full border rounded-lg" title="Preview PDF" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Voltar</Button>
            <Button
              variant="outline"
              onClick={handleCadastrarVhSys}
              disabled={vhsysLoading}
            >
              {vhsysLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              {vhsysLoading ? 'Cadastrando...' : 'Cadastrar Cliente no VhSys'}
            </Button>
            <Button onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Baixar PDF
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
          <DialogTitle>Resumo para Contrato — {orcamento.nome_cliente}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Preencha as informações abaixo para gerar o resumo para contrato. Os dados serão salvos no orçamento.
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
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Buscar Cliente Existente</Label>
                <ClienteSelector
                  modo="completo"
                  clienteSelecionado={clienteSelecionado}
                  onSelect={handleClienteSelect}
                  onClear={() => setClienteSelecionado(null)}
                />
              </div>

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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">CNPJ</Label>
                      <div className="flex gap-2">
                        <Input value={dadosCliente.cnpj || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" className="flex-1" />
                        <Button type="button" variant="outline" size="sm" onClick={handleBuscarCnpj} disabled={isSearchingCnpj || !dadosCliente.cnpj}>
                          {isSearchingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Razão Social</Label>
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
                      <Label className="text-xs">Endereço</Label>
                      <Input value={dadosCliente.endereco_cnpj || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, endereco_cnpj: e.target.value }))} placeholder="Rua, número, bairro" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CEP</Label>
                      <Input value={dadosCliente.cep_cnpj || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, cep_cnpj: e.target.value }))} placeholder="00000-000" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Estado</Label>
                      <Select value={dadosCliente.estado || ''} onValueChange={(v) => setDadosCliente(prev => ({ ...prev, estado: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione UF" /></SelectTrigger>
                        <SelectContent>
                          {UFS_BRASIL.map(u => <SelectItem key={u.uf} value={u.uf}>{u.uf} — {u.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cidade</Label>
                      <Input value={dadosCliente.cidade || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, cidade: e.target.value }))} placeholder="Cidade" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefone</Label>
                      <Input value={dadosCliente.telefone || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Email (recebimento de NF)</Label>
                      <Input type="email" value={dadosCliente.email || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, email: e.target.value }))} placeholder="email@exemplo.com" />
                    </div>
                  </div>

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
                2. Detalhes do Produto
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
                3. Forma de Venda do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={formaVenda} onValueChange={setFormaVenda} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="locais_fisicos" id="resumo-locais" />
                  <Label htmlFor="resumo-locais" className="font-normal cursor-pointer">Locais físicos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="venda_digital" id="resumo-digital" />
                  <Label htmlFor="resumo-digital" className="font-normal cursor-pointer">Venda digital</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ambas" id="resumo-ambas" />
                  <Label htmlFor="resumo-ambas" className="font-normal cursor-pointer">Ambas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sem_informacao" id="resumo-sem" />
                  <Label htmlFor="resumo-sem" className="font-normal cursor-pointer">Sem informação</Label>
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
                    <RadioGroupItem value="total_produtor" id="resumo-produtor" />
                    <Label htmlFor="resumo-produtor" className="font-normal cursor-pointer text-sm">Todo envio para o Produtor</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="total_lemoncaps" id="resumo-lemoncaps" />
                    <Label htmlFor="resumo-lemoncaps" className="font-normal cursor-pointer text-sm">Toda logística via Lemon Caps</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="parcial" id="resumo-parcial" />
                    <Label htmlFor="resumo-parcial" className="font-normal cursor-pointer text-sm">Envio Parcial</Label>
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
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGenerateProposta} disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</>
            ) : (
              'Gerar Resumo para Contrato'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
