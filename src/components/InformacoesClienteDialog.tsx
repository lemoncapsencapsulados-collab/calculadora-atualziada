import { useState, useEffect } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { Orcamento, DadosCliente, PessoaFisicaResponsavel } from '@/types/orcamento';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, User, Plus, Trash2 } from 'lucide-react';
import { ESTADOS_CIVIS, UFS_BRASIL, fetchEnderecoPorCEP } from '@/lib/brasilData';
import { validarCPF, validarEmail } from '@/lib/validators';
import ClienteSelector from '@/components/ClienteSelector';
import { useClientes, Cliente } from '@/hooks/useClientes';

const EMPTY_PF: PessoaFisicaResponsavel = {
  nome: '', cpf: '', rg: '', endereco: '', cep: '', cidade: '', estado: '', telefone: '', email: '', estado_civil: '',
};

function PessoaFisicaFields({ pessoa, onChange, label }: { pessoa: PessoaFisicaResponsavel; onChange: (p: PessoaFisicaResponsavel) => void; label: string }) {
  const update = (field: keyof PessoaFisicaResponsavel, value: string) => onChange({ ...pessoa, [field]: value });
  const [loadingCep, setLoadingCep] = useState(false);
  const [cpfError, setCpfError] = useState('');
  const [emailError, setEmailError] = useState('');

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
          <Label className="text-xs">Nome</Label>
          <Input value={pessoa.nome || ''} onChange={(e) => update('nome', e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CPF</Label>
          <Input value={pessoa.cpf || ''} onChange={(e) => update('cpf', e.target.value)} onBlur={handleCpfBlur} placeholder="000.000.000-00" className={cpfError ? 'border-destructive' : ''} />
          {cpfError && <p className="text-[10px] text-destructive">{cpfError}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">RG</Label>
          <Input value={pessoa.rg || ''} onChange={(e) => update('rg', e.target.value)} placeholder="RG" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado Civil</Label>
          <Select value={pessoa.estado_civil || ''} onValueChange={(v) => update('estado_civil', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {ESTADOS_CIVIS.map(ec => <SelectItem key={ec} value={ec}>{ec}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Endereço</Label>
          <Input value={pessoa.endereco || ''} onChange={(e) => update('endereco', e.target.value)} placeholder="Rua, número, bairro" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CEP{loadingCep && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}</Label>
          <Input value={pessoa.cep || ''} onChange={(e) => update('cep', e.target.value)} placeholder="00000-000" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select value={pessoa.estado || ''} onValueChange={(v) => { onChange({ ...pessoa, estado: v }); }}>
            <SelectTrigger><SelectValue placeholder="Selecione UF" /></SelectTrigger>
            <SelectContent>
              {UFS_BRASIL.map(u => <SelectItem key={u.uf} value={u.uf}>{u.uf} — {u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cidade</Label>
          <Input value={pessoa.cidade || ''} onChange={(e) => update('cidade', e.target.value)} placeholder="Cidade" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Telefone</Label>
          <Input value={pessoa.telefone || ''} onChange={(e) => update('telefone', e.target.value)} placeholder="(00) 00000-0000" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={pessoa.email || ''} onChange={(e) => update('email', e.target.value)} onBlur={handleEmailBlur} placeholder="email@exemplo.com" className={emailError ? 'border-destructive' : ''} />
          {emailError && <p className="text-[10px] text-destructive">{emailError}</p>}
        </div>
      </div>
    </div>
  );
}

export default function InformacoesClienteDialog({ orcamento, onClose }: { orcamento: Orcamento; onClose: () => void }) {
  const { updateDadosCliente } = useOrcamentos();
  const { atualizarCliente, criarCliente, buscarPorTelefone } = useClientes();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBuscandoCnpj, setIsBuscandoCnpj] = useState(false);
  const [tipoPessoa, setTipoPessoa] = useState<'pj' | 'pf'>('pj');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

  const [dados, setDados] = useState<DadosCliente>({
    tipo_pessoa: 'pj',
    cnpj: '', razao_social: '', inscricao_municipal: '', inscricao_estadual: '',
    endereco_cnpj: '', cep_cnpj: '', cidade: '', estado: '', telefone: '', email: '',
  });

  const [responsavelPJ, setResponsavelPJ] = useState<PessoaFisicaResponsavel>({ ...EMPTY_PF });
  const [pessoasFisicas, setPessoasFisicas] = useState<PessoaFisicaResponsavel[]>([{ ...EMPTY_PF }]);

  useEffect(() => {
    if (orcamento.dados_cliente) {
      const dc = orcamento.dados_cliente;
      setDados(prev => ({ ...prev, ...dc }));
      setTipoPessoa(dc.tipo_pessoa || 'pj');
      if (dc.responsavel_pj) setResponsavelPJ(dc.responsavel_pj);
      if (dc.pessoas_fisicas && dc.pessoas_fisicas.length > 0) setPessoasFisicas(dc.pessoas_fisicas);
    }
  }, [orcamento]);

  const handleClienteSelect = (cliente: Cliente) => {
    setClienteSelecionado(cliente);
    setTipoPessoa(cliente.tipo_pessoa as 'pj' | 'pf' || 'pj');
    setDados(prev => ({
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
  };

  // CEP auto-fill for PJ
  useEffect(() => {
    const cepNums = (dados.cep_cnpj || '').replace(/\D/g, '');
    if (cepNums.length === 8) {
      fetchEnderecoPorCEP(cepNums).then(result => {
        if (result) {
          setDados(prev => ({
            ...prev,
            endereco_cnpj: result.logradouro || prev.endereco_cnpj,
            cidade: result.cidade,
            estado: result.estado,
          }));
        }
      });
    }
  }, [dados.cep_cnpj]);

  const handleBuscarCnpj = async () => {
    if (!dados.cnpj) return;
    const cnpjLimpo = dados.cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      toast({ title: 'CNPJ inválido', description: 'O CNPJ deve ter 14 dígitos.', variant: 'destructive' });
      return;
    }
    setIsBuscandoCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (!response.ok) throw new Error('CNPJ não encontrado');
      const data = await response.json();
      const enderecoCompleto = [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(', ');
      setDados(prev => ({
        ...prev,
        razao_social: data.razao_social || '',
        endereco_cnpj: enderecoCompleto,
        cep_cnpj: data.cep || '',
        cidade: data.municipio || '',
        estado: data.uf || '',
        telefone: prev.telefone || data.ddd_telefone_1?.replace(/\D/g, '') || '',
        email: prev.email || data.email || '',
      }));
      toast({ title: 'CNPJ encontrado', description: 'Dados preenchidos automaticamente.' });
    } catch {
      toast({ title: 'Erro ao buscar CNPJ', description: 'CNPJ não encontrado ou serviço indisponível.', variant: 'destructive' });
    } finally {
      setIsBuscandoCnpj(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const dadosCompletos: DadosCliente = {
        ...dados,
        tipo_pessoa: tipoPessoa,
        responsavel_pj: tipoPessoa === 'pj' ? responsavelPJ : undefined,
        pessoas_fisicas: tipoPessoa === 'pf' ? pessoasFisicas : undefined,
      };
      await updateDadosCliente.mutateAsync({ id: orcamento.id, dados_cliente: dadosCompletos });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar dados do cliente:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Informações do Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Tipo de Pessoa</Label>
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
                    <Input value={dados.cnpj || ''} onChange={(e) => setDados(prev => ({ ...prev, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" className="flex-1" />
                    <Button type="button" variant="outline" onClick={handleBuscarCnpj} disabled={isBuscandoCnpj}>
                      {isBuscandoCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span className="ml-2">Buscar</span>
                    </Button>
                  </div>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Razão Social</Label>
                  <Input value={dados.razao_social || ''} onChange={(e) => setDados(prev => ({ ...prev, razao_social: e.target.value }))} placeholder="Razão social" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Inscrição Municipal</Label>
                  <Input value={dados.inscricao_municipal || ''} onChange={(e) => setDados(prev => ({ ...prev, inscricao_municipal: e.target.value }))} placeholder="Inscrição municipal" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Inscrição Estadual</Label>
                  <Input value={dados.inscricao_estadual || ''} onChange={(e) => setDados(prev => ({ ...prev, inscricao_estadual: e.target.value }))} placeholder="Inscrição estadual" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Endereço</Label>
                  <Input value={dados.endereco_cnpj || ''} onChange={(e) => setDados(prev => ({ ...prev, endereco_cnpj: e.target.value }))} placeholder="Rua, número, bairro" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CEP</Label>
                  <Input value={dados.cep_cnpj || ''} onChange={(e) => setDados(prev => ({ ...prev, cep_cnpj: e.target.value }))} placeholder="00000-000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Select value={dados.estado || ''} onValueChange={(v) => setDados(prev => ({ ...prev, estado: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione UF" /></SelectTrigger>
                    <SelectContent>
                      {UFS_BRASIL.map(u => <SelectItem key={u.uf} value={u.uf}>{u.uf} — {u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={dados.cidade || ''} onChange={(e) => setDados(prev => ({ ...prev, cidade: e.target.value }))} placeholder="Cidade" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={dados.telefone || ''} onChange={(e) => setDados(prev => ({ ...prev, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Email (recebimento de NF)</Label>
                  <Input type="email" value={dados.email || ''} onChange={(e) => setDados(prev => ({ ...prev, email: e.target.value }))} placeholder="email@exemplo.com" />
                </div>
              </div>
              <PessoaFisicaFields pessoa={responsavelPJ} onChange={setResponsavelPJ} label="Responsável PF (QSA)" />
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
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>) : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}