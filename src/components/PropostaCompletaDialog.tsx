import { useState, useEffect } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { Orcamento, DadosCliente, DetalhamentoFrete, DetalhamentoEnvio, CondicoesPagamento, PessoaFisicaResponsavel } from '@/types/orcamento';
import { generateOrcamentoPDFBlob, generateOrcamentoPDF } from '@/lib/orcamentoGenerator';
import { toast } from 'sonner';
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
import { Loader2, User, Truck, Download, PackageCheck, Search, ShoppingBag, AlertTriangle, Wallet, Beaker, Plus, Trash2, UserPlus, FileCheck, Users } from 'lucide-react';
import CondicoesPagamentoForm, { validarCondicoesPagamento } from './CondicoesPagamentoForm';
import { ESTADOS_CIVIS, UFS_BRASIL, fetchCidadesPorUF, fetchEnderecoPorCEP, getOpcoesPote, getOpcoesTampa } from '@/lib/brasilData';
import { validarCPF, validarCNPJ, validarEmail, formatarNomeProprio } from '@/lib/validators';
import { cadastrarClienteVhSys } from '@/lib/vhsysCliente';
import { supabase } from '@/integrations/supabase/client';
import { usePedidos } from '@/hooks/usePedidos';
import { valorPorExtensoBRL, formatBRL, dataPorExtenso } from '@/lib/extenso';
import { FileSignature } from 'lucide-react';
import { useContratoModelos } from '@/hooks/useContratoModelos';
import { AdminPasswordDialog } from '@/components/admin/AdminPasswordDialog';

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
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [enviandoFinanceiro, setEnviandoFinanceiro] = useState(false);
  const [enviadoFinanceiro, setEnviadoFinanceiro] = useState(false);
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

  // Frete (simplificado — apenas 2 opções)
  const [detalhamentoEnvio, setDetalhamentoEnvio] = useState<DetalhamentoEnvio>({
    tipo: 'total_lemoncaps', descricao_parcial: '',
  });
  const freteLemonCaps = detalhamentoEnvio.tipo === 'total_lemoncaps';
  const usaTabelaTradicional = false;

  // Detalhes de produção por item
  const [detalhesProducao, setDetalhesProducao] = useState<Record<number, Record<string, string>>>({});

  // VhSys: estado do botão de cadastro
  const [vhsysLoading, setVhsysLoading] = useState(false);
  const { registrarVhsysAsync } = usePedidos();

  // ZapSign: estado do botão de envio
  const [zapSignLoading, setZapSignLoading] = useState(false);
  const [zapSignDialogOpen, setZapSignDialogOpen] = useState(false);
  const [askSenhaZapOpen, setAskSenhaZapOpen] = useState(false);
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState<string>('');
  const { data: modelosContrato = [] } = useContratoModelos();

  type ZapExtraSigner = { name: string; email: string; phone_number: string };
  const [zapExtraSigners, setZapExtraSigners] = useState<ZapExtraSigner[]>([]);

  // Campos editáveis do contrato ZapSign
  type ZapSignCampos = {
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
  const [zapSignCampos, setZapSignCampos] = useState<ZapSignCampos | null>(null);

  const buildZapSignCamposPadrao = (): ZapSignCampos => {
    const isPJ = tipoPessoa === 'pj';
    const representante = isPJ ? (responsavelPJ || {} as any) : (pessoasFisicas[0] || {} as any);
    const signerName = formatarNomeProprio((representante.nome) || dadosCliente.razao_social || orcamento.nome_cliente || '');
    const signerEmail = representante.email || dadosCliente.email || '';
    const signerPhone = (representante.telefone || dadosCliente.telefone || '').replace(/\D/g, '');
    const razaoSocial = isPJ ? formatarNomeProprio(dadosCliente.razao_social || '') : formatarNomeProprio(representante.nome || '');
    const cnpjContratante = isPJ ? (dadosCliente.cnpj || '') : (representante.cpf || '');
    const enderecoContratante = isPJ
      ? [dadosCliente.endereco_cnpj, dadosCliente.cidade, dadosCliente.estado, dadosCliente.cep_cnpj].filter(Boolean).join(' - ')
      : [representante.endereco, representante.cidade, representante.estado, representante.cep].filter(Boolean).join(' - ');
    const primeiroItem = orcamento.itens_producao?.[0];
    const produtoDescricao = primeiroItem
      ? `${primeiroItem.nome_produto}${primeiroItem.segmento ? ` (${primeiroItem.segmento})` : ''}`
      : '';
    const produtoApresentacao = primeiroItem?.quantidade_por_pote
      ? `${primeiroItem.quantidade_por_pote} ${primeiroItem.unidade_por_pote || ''} por frasco`.trim()
      : '';
    const produtoPrecoUnit = primeiroItem ? formatBRL(primeiroItem.preco_unitario) : '';
    const produtoQuantidade = primeiroItem ? String(primeiroItem.quantidade) : '';
    const valorSetup = orcamento.subtotal_servicos || 0;
    const valorProducao = orcamento.subtotal_producao || 0;
    const valorTotal = orcamento.valor_total || 0;
    return {
      signer_name: signerName,
      signer_email: signerEmail,
      signer_phone_number: signerPhone,
      razao_social: razaoSocial,
      cnpj: cnpjContratante,
      endereco: enderecoContratante,
      email_contratante: dadosCliente.email || signerEmail,
      telefone_contratante: dadosCliente.telefone || signerPhone,
      nome_representante: formatarNomeProprio(representante.nome || ''),
      cpf_representante: representante.cpf || '',
      numero_contrato: orcamento.numero_orcamento || '',
      data_contrato: dataPorExtenso(new Date()),
      produto_descricao: produtoDescricao,
      produto_apresentacao: produtoApresentacao,
      produto_preco_unit: produtoPrecoUnit,
      produto_quantidade: produtoQuantidade,
      valor_setup: formatBRL(valorSetup),
      valor_setup_extenso: valorPorExtensoBRL(valorSetup),
      valor_producao: formatBRL(valorProducao),
      valor_producao_extenso: valorPorExtensoBRL(valorProducao),
      valor_total: formatBRL(valorTotal),
      valor_total_extenso: valorPorExtensoBRL(valorTotal),
    };
  };

  const abrirZapSignDialog = () => {
    setZapSignCampos(buildZapSignCamposPadrao());
    setZapExtraSigners([]);
    setZapSignDialogOpen(true);
  };

  // Constrói candidatos a signatários extras a partir dos dados do cliente do orçamento
  const buildCandidatosExtras = (): ZapExtraSigner[] => {
    const out: ZapExtraSigner[] = [];
    const push = (nome?: string, email?: string, tel?: string) => {
      if (!nome && !email) return;
      out.push({
        name: nome || '',
        email: email || '',
        phone_number: (tel || '').replace(/\D/g, ''),
      });
    };
    // Representante PJ
    if (responsavelPJ) push(responsavelPJ.nome, responsavelPJ.email, responsavelPJ.telefone);
    // Pessoas físicas
    (pessoasFisicas || []).forEach((pf) => push(pf?.nome, pf?.email, pf?.telefone));
    // Contato geral do cliente
    push(dadosCliente.razao_social || orcamento.nome_cliente, dadosCliente.email, dadosCliente.telefone);
    // Dedup
    const seen = new Set<string>();
    return out.filter((s) => {
      const key = (s.email || s.name).toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const adicionarSignatarioZap = () => {
    setZapExtraSigners((prev) => {
      const candidatos = buildCandidatosExtras();
      const k = (s: { name?: string; email?: string }) => (s.email || s.name || '').toLowerCase().trim();
      const usados = new Set<string>();
      usados.add(k({ name: zapSignCampos?.signer_name, email: zapSignCampos?.signer_email }));
      prev.forEach((s) => usados.add(k(s)));
      const proximo = candidatos.find((c) => {
        const key = k(c);
        return key && !usados.has(key);
      });
      return [...prev, proximo || { name: '', email: '', phone_number: '' }];
    });
  };

  const updateZapCampo = (k: keyof ZapSignCampos, v: string) => {
    setZapSignCampos(prev => prev ? { ...prev, [k]: v } : prev);
  };

  const [zapCnpjLoading, setZapCnpjLoading] = useState(false);
  const [zapUltimoCnpj, setZapUltimoCnpj] = useState('');
  const consultarCnpjZap = async (cnpjRaw: string, force = false) => {
    const nums = (cnpjRaw || '').replace(/\D/g, '');
    if (nums.length !== 14) return;
    if (!force && nums === zapUltimoCnpj) return;
    setZapUltimoCnpj(nums);
    setZapCnpjLoading(true);
    try {
      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${nums}`);
      if (!resp.ok) { toast.error('CNPJ não encontrado na Receita.'); return; }
      const d = await resp.json();
      const endereco = [
        [d.logradouro, d.numero].filter(Boolean).join(', '),
        d.complemento, d.bairro,
        d.municipio && d.uf ? `${d.municipio} - ${d.uf}` : (d.municipio || d.uf),
        d.cep ? `CEP ${String(d.cep).replace(/(\d{5})(\d{3})/, '$1-$2')}` : '',
      ].filter(Boolean).join(' - ');
      const formatarTel = (t: any) => {
        const n = String(t || '').replace(/\D/g, '');
        if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
        if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
        return n;
      };
      const telefone = [d.ddd_telefone_1, d.ddd_telefone_2]
        .map(formatarTel)
        .filter(Boolean)
        .join(' / ');
      // Para MEI, a Receita devolve a razão social com o CPF do titular concatenado no final.
      // Removemos qualquer sequência de 11 dígitos (com ou sem espaços) ao final do nome.
      const razaoSocialLimpa = String(d.razao_social || d.nome_fantasia || '')
        .replace(/\s*\d{11}\s*$/, '')
        .replace(/\s*\d{3}\.?\d{3}\.?\d{3}-?\d{2}\s*$/, '')
        .trim();
      setZapSignCampos(prev => prev ? {
        ...prev,
        razao_social: (razaoSocialLimpa || prev.razao_social || ''),
        endereco: endereco || prev.endereco,
        email_contratante: (d.email || prev.email_contratante || ''),
        telefone_contratante: telefone || prev.telefone_contratante || '',
      } : prev);
      toast.success('Dados do CNPJ preenchidos automaticamente.');
    } catch (e: any) {
      toast.error(`Falha ao consultar CNPJ: ${e?.message || 'erro'}`);
    } finally {
      setZapCnpjLoading(false);
    }
  };

  useEffect(() => {
    if (zapSignDialogOpen && !modeloSelecionadoId && modelosContrato.length > 0) {
      const padrao = modelosContrato.find(m => m.is_padrao);
      setModeloSelecionadoId((padrao || modelosContrato[0]).id);
    }
  }, [zapSignDialogOpen, modelosContrato, modeloSelecionadoId]);

  const handleEnviarZapSign = async () => {
    const modelo = modelosContrato.find(m => m.id === modeloSelecionadoId);
    if (!modelo) {
      toast.error('Selecione um modelo de contrato.');
      return;
    }
    const campos = zapSignCampos || buildZapSignCamposPadrao();
    setZapSignLoading(true);
    try {
      const signerName = campos.signer_name;
      const signerEmail = campos.signer_email;
      const signerPhone = (campos.signer_phone_number || '').replace(/\D/g, '');

      if (!signerName || !signerEmail) {
        toast.error('Preencha nome e email do representante antes de enviar para a ZapSign.');
        setZapSignLoading(false);
        return;
      }
      if (!campos.nome_representante?.trim()) {
        toast.error('Informe o nome do representante legal.');
        setZapSignLoading(false);
        return;
      }
      const cpfRep = (campos.cpf_representante || '').replace(/\D/g, '');
      if (!cpfRep || !validarCPF(cpfRep)) {
        toast.error('Informe um CPF válido para o representante legal.');
        setZapSignLoading(false);
        return;
      }
      for (const s of zapExtraSigners) {
        if (!s.name?.trim() || !s.email?.trim()) {
          toast.error('Preencha nome e email de todos os signatários adicionais.');
          setZapSignLoading(false);
          return;
        }
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
          signer_name: signerName,
          signer_email: signerEmail,
          signer_phone_country: '55',
          signer_phone_number: signerPhone,
          lang: 'pt-br',
          send_automatic_email: true,
          data,
          template_id: modelo.template_id,
          ambiente: modelo.ambiente,
          orcamento_id: orcamento.id,
          cliente_id: orcamento.cliente_id ?? null,
          extra_signers: zapExtraSigners
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
          extra = txt ? ` — ${txt}` : '';
        } catch { /* noop */ }
        toast.error(`Erro ZapSign: ${error.message}${extra}`);
        return;
      }

      if (resp?.token && Array.isArray(resp?.signers) && resp.signers[0]?.sign_url) {
        const url = resp.signers[0].sign_url;
        toast.success('Contrato criado na ZapSign!', {
          description: 'Clique para abrir o documento',
          action: { label: 'Abrir', onClick: () => window.open(url, '_blank') },
          duration: 10000,
        });
        setZapSignDialogOpen(false);
      } else if (resp?.error) {
        toast.error(`ZapSign: ${resp.error}${resp.status ? ` (${resp.status})` : ''}`);
      } else {
        toast.success('Contrato criado na ZapSign!');
      }
    } catch (err: any) {
      toast.error(`Falha ao enviar para ZapSign: ${err?.message || 'erro desconhecido'}`);
    } finally {
      setZapSignLoading(false);
    }
  };

  const handleCadastrarVhSys = async () => {
    setVhsysLoading(true);
    try {
      const result = await cadastrarClienteVhSys({
        orcamento,
        tipoPessoa,
        dadosCliente,
        pessoasFisicas,
        responsavelPJ,
      });
      if (result.success) {
        toast.success('Cliente cadastrado com sucesso no VhSys!');
      } else {
        toast.error(result.error || 'Falha ao cadastrar cliente no VhSys.');
      }
      // Vincula no histórico do pedido (se existir um pedido para este orçamento)
      try {
        const { data: ped } = await supabase
          .from('pedidos')
          .select('id')
          .eq('orcamento_id', orcamento.id)
          .limit(1)
          .maybeSingle();
        if (ped?.id) {
          await registrarVhsysAsync({
            pedidoId: ped.id,
            entry: {
              data: new Date().toISOString(),
              sucesso: !!result.success,
              mensagem: result.success
                ? `Cliente cadastrado no VhSys via Proposta Completa.`
                : (result.error || 'Falha ao cadastrar cliente no VhSys.'),
              origem: 'proposta_completa',
              payload: result.payload,
              resposta: (result as any).data ?? null,
            },
          });
        }
      } catch (e) { console.error('Falha ao registrar histórico VhSys', e); }
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
    if (orcamento.detalhamento_frete?.detalhamento_envio) {
      const t = orcamento.detalhamento_frete.detalhamento_envio.tipo;
      setDetalhamentoEnvio({
        tipo: t === 'total_produtor' ? 'total_produtor' : 'total_lemoncaps',
        descricao_parcial: '',
      });
    } else if (orcamento.detalhamento_frete) {
      setDetalhamentoEnvio({
        tipo: orcamento.detalhamento_frete.frete_lemon_caps === false ? 'total_produtor' : 'total_lemoncaps',
        descricao_parcial: '',
      });
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
    if (r.detalhamento_frete?.detalhamento_envio) {
      const t = r.detalhamento_frete.detalhamento_envio.tipo;
      setDetalhamentoEnvio({
        tipo: t === 'total_produtor' ? 'total_produtor' : 'total_lemoncaps',
        descricao_parcial: '',
      });
    } else if (r.detalhamento_frete) {
      setDetalhamentoEnvio({
        tipo: r.detalhamento_frete.frete_lemon_caps === false ? 'total_produtor' : 'total_lemoncaps',
        descricao_parcial: '',
      });
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

  // Auto buscar CNPJ ao completar 14 dígitos (PJ)
  useEffect(() => {
    const nums = (dadosCliente.cnpj || '').replace(/\D/g, '');
    if (tipoPessoa !== 'pj' || nums.length !== 14 || isSearchingCnpj) return;
    handleBuscarCnpj();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosCliente.cnpj, tipoPessoa]);

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
    // CNPJ obrigatório para PJ
    if (tipoPessoa === 'pj') {
      const cnpjNums = (dadosCliente.cnpj || '').replace(/\D/g, '');
      if (cnpjNums.length !== 14) {
        toast.error('CNPJ é obrigatório e deve conter 14 dígitos.');
        return;
      }
    }
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
      setPdfBlob(blob);
      setEnviadoFinanceiro(false);
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

  const handleEnviarFinanceiro = async () => {
    if (!pdfBlob) {
      toast.error('PDF não disponível para envio.');
      return;
    }
    setEnviandoFinanceiro(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(pdfBlob);
      });

      const valorTotal = (orcamento as any).valor_total ?? (orcamento as any).total ?? 0;
      const valorTotalFmt = typeof valorTotal === 'number'
        ? valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : String(valorTotal || '');

      const razaoSocial = tipoPessoa === 'pj' ? (dadosCliente.razao_social || '') : '';
      const cnpj = tipoPessoa === 'pj' ? (dadosCliente.cnpj || '') : '';

      const { data, error } = await supabase.functions.invoke('enviar-projeto-financeiro', {
        body: {
          pdfBase64: base64,
          filename: `projeto-${orcamento.numero_orcamento || orcamento.id}.pdf`,
          consultorNome: orcamento.consultor_responsavel || '',
          razaoSocial,
          cnpj,
          cliente: orcamento.nome_cliente || '',
          valorTotal: valorTotalFmt,
          orcamentoId: orcamento.id,
          orcamentoNumero: orcamento.numero_orcamento || '',
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setEnviadoFinanceiro(true);
      toast.success('Projeto enviado ao Financeiro.');
    } catch (err: any) {
      console.error('Erro ao enviar ao Financeiro:', err);
      toast.error('Erro ao enviar ao Financeiro: ' + (err?.message || 'desconhecido'));
    } finally {
      setEnviandoFinanceiro(false);
    }
  };

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const zapSignDialog = () => (
    <>
    <Dialog open={zapSignDialogOpen} onOpenChange={setZapSignDialogOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar contrato para ZapSign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {modelosContrato.length === 0 ? (
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                Nenhum modelo de contrato cadastrado. Acesse <strong>Config. Contratos</strong> no menu para criar um.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Modelo de contrato</Label>
                <Select value={modeloSelecionadoId} onValueChange={setModeloSelecionadoId}>
                  <SelectTrigger><SelectValue placeholder="Escolha um modelo" /></SelectTrigger>
                  <SelectContent>
                    {modelosContrato.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome} {m.is_padrao ? '★' : ''} — {m.ambiente === 'producao' ? 'Produção' : 'Sandbox'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const m = modelosContrato.find(x => x.id === modeloSelecionadoId);
                  return m?.descricao ? (
                    <p className="text-xs text-muted-foreground">{m.descricao}</p>
                  ) : null;
                })()}
              </div>

              {zapSignCampos && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Revise os campos do contrato</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setZapSignCampos(buildZapSignCamposPadrao())}
                    >
                      Restaurar padrão
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Signatário (quem assina)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome do signatário *</Label>
                        <Input
                          value={zapSignCampos.signer_name}
                          onChange={(e) => updateZapCampo('signer_name', e.target.value)}
                          onBlur={(e) => updateZapCampo('signer_name', formatarNomeProprio(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email do signatário *</Label>
                        <Input type="email" value={zapSignCampos.signer_email} onChange={(e) => updateZapCampo('signer_email', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Telefone (DDD + número)</Label>
                        <Input value={zapSignCampos.signer_phone_number} onChange={(e) => updateZapCampo('signer_phone_number', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        <p className="text-xs font-semibold uppercase">Signatários adicionais</p>
                        {zapExtraSigners.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {zapExtraSigners.length + 1} no total
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={adicionarSignatarioZap}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      O contrato só será considerado <strong>assinado</strong> e vinculado ao orçamento/pedido quando <strong>todos</strong> os signatários assinarem.
                    </p>
                    {zapExtraSigners.map((s, idx) => (
                      <div key={idx} className="rounded-md border bg-background p-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Signatário #{idx + 2}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => setZapExtraSigners((p) => p.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Nome *</Label>
                            <Input
                              value={s.name}
                              onChange={(e) => setZapExtraSigners((p) => p.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))}
                              onBlur={(e) => setZapExtraSigners((p) => p.map((it, i) => i === idx ? { ...it, name: formatarNomeProprio(e.target.value) } : it))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Email *</Label>
                            <Input type="email" value={s.email} onChange={(e) => setZapExtraSigners((p) => p.map((it, i) => i === idx ? { ...it, email: e.target.value } : it))} />
                          </div>
                          <div className="space-y-1 col-span-2">
                            <Label className="text-xs">Telefone (DDD + número)</Label>
                            <Input value={s.phone_number} onChange={(e) => setZapExtraSigners((p) => p.map((it, i) => i === idx ? { ...it, phone_number: e.target.value } : it))} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Contratante</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Razão Social / Nome</Label>
                        <Input
                          value={zapSignCampos.razao_social}
                          onChange={(e) => updateZapCampo('razao_social', e.target.value)}
                          onBlur={(e) => updateZapCampo('razao_social', formatarNomeProprio(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-2">
                          CNPJ / CPF
                          {zapCnpjLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            value={zapSignCampos.cnpj}
                            onChange={(e) => updateZapCampo('cnpj', e.target.value)}
                            onBlur={(e) => consultarCnpjZap(e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Consultar CNPJ na Receita"
                            onClick={() => consultarCnpjZap(zapSignCampos.cnpj, true)}
                            disabled={zapCnpjLoading || (zapSignCampos.cnpj || '').replace(/\D/g, '').length !== 14}
                          >
                            {zapCnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Telefone do contratante</Label>
                        <Input value={zapSignCampos.telefone_contratante} onChange={(e) => updateZapCampo('telefone_contratante', e.target.value)} />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Endereço</Label>
                        <Textarea rows={2} value={zapSignCampos.endereco} onChange={(e) => updateZapCampo('endereco', e.target.value)} />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Email do contratante</Label>
                        <Input type="email" value={zapSignCampos.email_contratante} onChange={(e) => updateZapCampo('email_contratante', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Representante</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome do representante legal *</Label>
                        <Input
                          value={zapSignCampos.nome_representante}
                          onChange={(e) => updateZapCampo('nome_representante', e.target.value)}
                          onBlur={(e) => updateZapCampo('nome_representante', formatarNomeProprio(e.target.value))}
                          placeholder="Nome completo do representante"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">CPF do representante legal *</Label>
                        <Input
                          value={zapSignCampos.cpf_representante}
                          onChange={(e) => updateZapCampo('cpf_representante', e.target.value)}
                          placeholder="000.000.000-00"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Contrato</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Número do contrato</Label>
                        <Input value={zapSignCampos.numero_contrato} onChange={(e) => updateZapCampo('numero_contrato', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Data do contrato</Label>
                        <Input value={zapSignCampos.data_contrato} onChange={(e) => updateZapCampo('data_contrato', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Produto</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Descrição do produto</Label>
                        <Input value={zapSignCampos.produto_descricao} onChange={(e) => updateZapCampo('produto_descricao', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Apresentação</Label>
                        <Input value={zapSignCampos.produto_apresentacao} onChange={(e) => updateZapCampo('produto_apresentacao', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quantidade</Label>
                        <Input value={zapSignCampos.produto_quantidade} onChange={(e) => updateZapCampo('produto_quantidade', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Preço unitário</Label>
                        <Input value={zapSignCampos.produto_preco_unit} onChange={(e) => updateZapCampo('produto_preco_unit', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Valores</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Setup</Label>
                        <Input value={zapSignCampos.valor_setup} onChange={(e) => updateZapCampo('valor_setup', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Setup (por extenso)</Label>
                        <Input value={zapSignCampos.valor_setup_extenso} onChange={(e) => updateZapCampo('valor_setup_extenso', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Produção</Label>
                        <Input value={zapSignCampos.valor_producao} onChange={(e) => updateZapCampo('valor_producao', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Produção (por extenso)</Label>
                        <Input value={zapSignCampos.valor_producao_extenso} onChange={(e) => updateZapCampo('valor_producao_extenso', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Total</Label>
                        <Input value={zapSignCampos.valor_total} onChange={(e) => updateZapCampo('valor_total', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Total (por extenso)</Label>
                        <Input value={zapSignCampos.valor_total_extenso} onChange={(e) => updateZapCampo('valor_total_extenso', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setZapSignDialogOpen(false)} disabled={zapSignLoading}>Cancelar</Button>
          <Button onClick={() => setAskSenhaZapOpen(true)} disabled={zapSignLoading || !modeloSelecionadoId}>
            {zapSignLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSignature className="w-4 h-4 mr-2" />}
            {zapSignLoading ? 'Enviando...' : 'Enviar agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AdminPasswordDialog
      open={askSenhaZapOpen}
      onOpenChange={setAskSenhaZapOpen}
      title="Confirmar envio do contrato"
      description="O contrato será enviado para assinatura via ZapSign. Digite a senha de administrador."
      actionLabel="Enviar contrato"
      onConfirm={handleEnviarZapSign}
    />
    </>
  );

  if (showPreview && pdfUrl) {
    return (
      <>
        <Dialog open onOpenChange={() => onClose()}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Preview do Projeto para Contrato</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0">
              <iframe src={pdfUrl} className="w-full h-full border rounded-lg" title="Preview PDF" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Baixar Documento
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(false)} disabled={enviandoFinanceiro}>
                Voltar e editar documento
              </Button>
              <Button
                onClick={handleEnviarFinanceiro}
                disabled={enviandoFinanceiro || enviadoFinanceiro}
                className={enviadoFinanceiro ? 'bg-green-600 hover:bg-green-600 text-white' : ''}
              >
                {enviandoFinanceiro ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                ) : enviadoFinanceiro ? (
                  'Enviado'
                ) : (
                  'Enviar Documento'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {zapSignDialog()}
      </>
    );
  }

  // Modo visualizar: mostra o PDF salvo no storage com opção de baixar/editar
  if (viewMode === 'visualizar') {
    const signedUrl = resumoSalvo?.signedUrl;
    return (
      <>
        <Dialog open onOpenChange={() => onClose()}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Resumo do Contrato — {orcamento.nome_cliente}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0">
              {loadingResumo ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando resumo...
                </div>
              ) : signedUrl ? (
                <iframe src={signedUrl} className="w-full h-full border rounded-lg" title="Resumo do Contrato" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <AlertTriangle className="w-8 h-8" />
                  <p>Nenhum resumo de contrato salvo para este orçamento.</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button variant="outline" onClick={() => setViewMode('editar')}>
                <FileCheck className="w-4 h-4 mr-2" />Editar Resumo
              </Button>
              {resumoSalvo?.resumo && (
                <Button onClick={() => baixarPdfContrato(
                  resumoSalvo.resumo.pdf_path,
                  `Resumo-Contrato-${orcamento.numero_orcamento}.pdf`
                )}>
                  <Download className="w-4 h-4 mr-2" />Baixar PDF
                </Button>
              )}
              <Button
                variant="outline"
                onClick={abrirZapSignDialog}
                disabled={zapSignLoading}
              >
                {zapSignLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSignature className="w-4 h-4 mr-2" />
                )}
                {zapSignLoading ? 'Enviando...' : 'Enviar para ZapSign'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {zapSignDialog()}
      </>
    );
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Projeto para Contrato — {orcamento.nome_cliente}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Preencha as informações abaixo para gerar o projeto para contrato. Os dados serão salvos no orçamento.
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
                      <Label className="text-xs">CNPJ <span className="text-destructive">*</span></Label>
                      <div className="flex gap-2">
                        <Input value={dadosCliente.cnpj || ''} onChange={(e) => setDadosCliente(prev => ({ ...prev, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" className="flex-1" />
                        <Button type="button" variant="outline" size="sm" onClick={handleBuscarCnpj} disabled={isSearchingCnpj || !dadosCliente.cnpj}>
                          {isSearchingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                      </div>
                      {isSearchingCnpj && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Buscando dados do CNPJ...
                        </p>
                      )}
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
                  value={detalhamentoEnvio.tipo === 'total_produtor' ? 'total_produtor' : 'total_lemoncaps'}
                  onValueChange={(value) => setDetalhamentoEnvio({
                    tipo: value as DetalhamentoEnvio['tipo'],
                    descricao_parcial: '',
                  })}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="total_produtor" id="resumo-produtor" />
                    <Label htmlFor="resumo-produtor" className="font-normal cursor-pointer text-sm">
                      Envio Total dos Potes para o Produtor (CNPJ)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="total_lemoncaps" id="resumo-lemoncaps" />
                    <Label htmlFor="resumo-lemoncaps" className="font-normal cursor-pointer text-sm">
                      Envios da Lemon Caps para o cliente final (CPF)
                    </Label>
                  </div>
                </RadioGroup>
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
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGenerateProposta} disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</>
            ) : (
              'Enviar contrato para Financeiro'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
