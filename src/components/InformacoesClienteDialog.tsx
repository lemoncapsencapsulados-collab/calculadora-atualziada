import { useState, useEffect } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { Orcamento, DadosCliente } from '@/types/orcamento';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, User } from 'lucide-react';

interface InformacoesClienteDialogProps {
  orcamento: Orcamento;
  onClose: () => void;
}

export default function InformacoesClienteDialog({
  orcamento,
  onClose,
}: InformacoesClienteDialogProps) {
  const { updateDadosCliente } = useOrcamentos();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBuscandoCnpj, setIsBuscandoCnpj] = useState(false);
  
  const [dados, setDados] = useState<DadosCliente>({
    nome_completo: '',
    email: '',
    telefone: '',
    cpf: '',
    cnpj: '',
    razao_social: '',
    endereco_cnpj: '',
    cep_cnpj: '',
    cidade: '',
    estado: '',
  });

  useEffect(() => {
    if (orcamento.dados_cliente) {
      setDados({
        nome_completo: orcamento.dados_cliente.nome_completo || '',
        email: orcamento.dados_cliente.email || '',
        telefone: orcamento.dados_cliente.telefone || '',
        cpf: orcamento.dados_cliente.cpf || '',
        cnpj: orcamento.dados_cliente.cnpj || '',
        razao_social: orcamento.dados_cliente.razao_social || '',
        endereco_cnpj: orcamento.dados_cliente.endereco_cnpj || '',
        cep_cnpj: orcamento.dados_cliente.cep_cnpj || '',
        cidade: orcamento.dados_cliente.cidade || '',
        estado: orcamento.dados_cliente.estado || '',
      });
    }
  }, [orcamento]);

  const handleBuscarCnpj = async () => {
    if (!dados.cnpj) {
      toast({
        title: 'CNPJ não informado',
        description: 'Digite o CNPJ para buscar.',
        variant: 'destructive',
      });
      return;
    }

    const cnpjLimpo = dados.cnpj.replace(/\D/g, '');
    
    if (cnpjLimpo.length !== 14) {
      toast({
        title: 'CNPJ inválido',
        description: 'O CNPJ deve ter 14 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    setIsBuscandoCnpj(true);

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      
      if (!response.ok) {
        throw new Error('CNPJ não encontrado');
      }

      const data = await response.json();

      // Montar endereço completo
      const enderecoPartes = [
        data.logradouro,
        data.numero,
        data.complemento,
        data.bairro,
      ].filter(Boolean);
      const enderecoCompleto = enderecoPartes.join(', ');

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

      toast({
        title: 'CNPJ encontrado',
        description: 'Dados preenchidos automaticamente.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao buscar CNPJ',
        description: 'CNPJ não encontrado ou serviço indisponível.',
        variant: 'destructive',
      });
    } finally {
      setIsBuscandoCnpj(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      await updateDadosCliente.mutateAsync({
        id: orcamento.id,
        dados_cliente: dados,
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar dados do cliente:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatTelefone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
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
          {/* Nome Completo */}
          <div className="space-y-2">
            <Label htmlFor="nome_completo">Nome Completo</Label>
            <Input
              id="nome_completo"
              value={dados.nome_completo}
              onChange={(e) => setDados(prev => ({ ...prev, nome_completo: e.target.value }))}
              placeholder="Nome completo do cliente"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={dados.email}
              onChange={(e) => setDados(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@exemplo.com"
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="telefone">Número de Contato</Label>
            <Input
              id="telefone"
              value={dados.telefone}
              onChange={(e) => setDados(prev => ({ ...prev, telefone: formatTelefone(e.target.value) }))}
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* CPF */}
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF do Cliente</Label>
            <Input
              id="cpf"
              value={dados.cpf}
              onChange={(e) => setDados(prev => ({ ...prev, cpf: formatCpf(e.target.value) }))}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-muted-foreground mb-4">Dados da Empresa</p>
          </div>

          {/* CNPJ */}
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <div className="flex gap-2">
              <Input
                id="cnpj"
                value={dados.cnpj}
                onChange={(e) => setDados(prev => ({ ...prev, cnpj: formatCnpj(e.target.value) }))}
                placeholder="00.000.000/0000-00"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBuscarCnpj}
                disabled={isBuscandoCnpj}
              >
                {isBuscandoCnpj ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="ml-2">Buscar</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Clique em buscar para preencher automaticamente
            </p>
          </div>

          {/* Razão Social */}
          <div className="space-y-2">
            <Label htmlFor="razao_social">Razão Social</Label>
            <Input
              id="razao_social"
              value={dados.razao_social}
              onChange={(e) => setDados(prev => ({ ...prev, razao_social: e.target.value }))}
              placeholder="Razão social da empresa"
            />
          </div>

          {/* Endereço */}
          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço do CNPJ</Label>
            <Input
              id="endereco"
              value={dados.endereco_cnpj}
              onChange={(e) => setDados(prev => ({ ...prev, endereco_cnpj: e.target.value }))}
              placeholder="Rua, número, bairro..."
            />
          </div>

          {/* CEP, Cidade, Estado */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={dados.cep_cnpj}
                onChange={(e) => setDados(prev => ({ ...prev, cep_cnpj: formatCep(e.target.value) }))}
                placeholder="00000-000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={dados.cidade}
                onChange={(e) => setDados(prev => ({ ...prev, cidade: e.target.value }))}
                placeholder="Cidade"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Input
                id="estado"
                value={dados.estado}
                onChange={(e) => setDados(prev => ({ ...prev, estado: e.target.value.toUpperCase().slice(0, 2) }))}
                placeholder="UF"
                maxLength={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
