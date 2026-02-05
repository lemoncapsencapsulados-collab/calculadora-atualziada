import { useState, useEffect } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { Orcamento, DadosCliente, DetalhamentoFrete, DetalhamentoEnvio } from '@/types/orcamento';
import { generateOrcamentoPDFBlob, generateOrcamentoPDF } from '@/lib/orcamentoGenerator';
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
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, Truck, Download, PackageCheck, Search, ShoppingBag } from 'lucide-react';

interface PropostaCompletaDialogProps {
  orcamento: Orcamento;
  onClose: () => void;
}

export default function PropostaCompletaDialog({
  orcamento,
  onClose,
}: PropostaCompletaDialogProps) {
  const { updateDadosCliente, updateDetalhamentoFrete } = useOrcamentos();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Dados do cliente
  const [dadosCliente, setDadosCliente] = useState<DadosCliente>({
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

  // Forma de venda
  const [formaVenda, setFormaVenda] = useState<string>('sem_informacao');

  // Detalhamento de frete
  const [freteLemonCaps, setFreteLemonCaps] = useState<boolean>(true);
  const [usaTabelaTradicional, setUsaTabelaTradicional] = useState<boolean>(true);
  const [detalhamentoEnvio, setDetalhamentoEnvio] = useState<DetalhamentoEnvio>({
    tipo: 'total_lemoncaps',
    descricao_parcial: '',
  });

  useEffect(() => {
    // Carregar dados existentes
    if (orcamento.dados_cliente) {
      setDadosCliente({
        ...dadosCliente,
        ...orcamento.dados_cliente,
      });
      setFormaVenda(orcamento.dados_cliente.forma_venda || 'sem_informacao');
    }
    if (orcamento.detalhamento_frete) {
      setFreteLemonCaps(orcamento.detalhamento_frete.frete_lemon_caps ?? true);
      setUsaTabelaTradicional(orcamento.detalhamento_frete.usa_tabela_tradicional ?? true);
      if (orcamento.detalhamento_frete.detalhamento_envio) {
        setDetalhamentoEnvio(orcamento.detalhamento_frete.detalhamento_envio);
      }
    }
  }, [orcamento]);

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
          endereco_cnpj: [
            data.logradouro,
            data.numero,
            data.complemento,
            data.bairro
          ].filter(Boolean).join(', ') || '',
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

  const handleGenerateProposta = async () => {
    setIsSubmitting(true);
    
    try {
      // Salvar dados do cliente com forma de venda
      const dadosClienteCompletos: DadosCliente = {
        ...dadosCliente,
        forma_venda: formaVenda as DadosCliente['forma_venda'],
      };
      
      await updateDadosCliente.mutateAsync({
        id: orcamento.id,
        dados_cliente: dadosClienteCompletos,
      });

      // Salvar detalhamento de frete
      const detalhamentoFrete: DetalhamentoFrete = {
        frete_lemon_caps: freteLemonCaps,
        usa_tabela_tradicional: usaTabelaTradicional,
        planos_customizados: orcamento.detalhamento_frete?.planos_customizados || [],
        detalhamento_envio: detalhamentoEnvio,
      };

      await updateDetalhamentoFrete.mutateAsync({
        id: orcamento.id,
        detalhamento_frete: detalhamentoFrete,
      });

      // Criar orçamento atualizado para gerar PDF
      const orcamentoAtualizado: Orcamento = {
        ...orcamento,
        dados_cliente: dadosClienteCompletos,
        detalhamento_frete: detalhamentoFrete,
      };

      // Gerar preview do PDF
      const blob = await generateOrcamentoPDFBlob(orcamentoAtualizado);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setShowPreview(true);
    } catch (error) {
      console.error('Erro ao gerar proposta:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    const orcamentoAtualizado: Orcamento = {
      ...orcamento,
      dados_cliente: {
        ...dadosCliente,
        forma_venda: formaVenda as DadosCliente['forma_venda'],
      },
      detalhamento_frete: {
        frete_lemon_caps: freteLemonCaps,
        usa_tabela_tradicional: usaTabelaTradicional,
        planos_customizados: orcamento.detalhamento_frete?.planos_customizados || [],
        detalhamento_envio: detalhamentoEnvio,
      },
    };
    await generateOrcamentoPDF(orcamentoAtualizado);
    onClose();
  };

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  if (showPreview && pdfUrl) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview da Proposta Completa</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0">
            <iframe
              src={pdfUrl}
              className="w-full h-full border rounded-lg"
              title="Preview PDF"
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Voltar
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
          <DialogTitle>Gerar Proposta Completa</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Preencha as informações abaixo para gerar a proposta completa com dados do cliente e frete.
          </p>

          {/* 1. Informações do Cliente */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                1. Informações do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome Completo</Label>
                  <Input
                    value={dadosCliente.nome_completo || ''}
                    onChange={(e) => setDadosCliente(prev => ({ ...prev, nome_completo: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={dadosCliente.email || ''}
                    onChange={(e) => setDadosCliente(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={dadosCliente.telefone || ''}
                    onChange={(e) => setDadosCliente(prev => ({ ...prev, telefone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CPF</Label>
                  <Input
                    value={dadosCliente.cpf || ''}
                    onChange={(e) => setDadosCliente(prev => ({ ...prev, cpf: e.target.value }))}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      value={dadosCliente.cnpj || ''}
                      onChange={(e) => setDadosCliente(prev => ({ ...prev, cnpj: e.target.value }))}
                      placeholder="00.000.000/0000-00"
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={handleBuscarCnpj}
                      disabled={isSearchingCnpj || !dadosCliente.cnpj}
                    >
                      {isSearchingCnpj ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Razão Social</Label>
                  <Input
                    value={dadosCliente.razao_social || ''}
                    onChange={(e) => setDadosCliente(prev => ({ ...prev, razao_social: e.target.value }))}
                    placeholder="Razão social"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Endereço</Label>
                  <Input
                    value={dadosCliente.endereco_cnpj || ''}
                    onChange={(e) => setDadosCliente(prev => ({ ...prev, endereco_cnpj: e.target.value }))}
                    placeholder="Rua, número, bairro"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input
                    value={dadosCliente.cidade || ''}
                    onChange={(e) => setDadosCliente(prev => ({ ...prev, cidade: e.target.value }))}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Input
                    value={dadosCliente.estado || ''}
                    onChange={(e) => setDadosCliente(prev => ({ ...prev, estado: e.target.value }))}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Forma de Venda do Cliente */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                2. Forma de Venda do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-sm text-muted-foreground mb-3 block">
                Como o cliente vende seus produtos?
              </Label>
              <RadioGroup
                value={formaVenda}
                onValueChange={setFormaVenda}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="locais_fisicos" id="locais" />
                  <Label htmlFor="locais" className="font-normal cursor-pointer">
                    Locais físicos
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="venda_digital" id="digital" />
                  <Label htmlFor="digital" className="font-normal cursor-pointer">
                    Venda digital
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ambas" id="ambas" />
                  <Label htmlFor="ambas" className="font-normal cursor-pointer">
                    Ambas
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sem_informacao" id="sem-info" />
                  <Label htmlFor="sem-info" className="font-normal cursor-pointer">
                    Sem informação
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* 3. Detalhamento de Frete */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-4 h-4" />
                3. Detalhamento de Frete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Detalhamento de Envio */}
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
                    <RadioGroupItem value="total_produtor" id="proposta-produtor" />
                    <Label htmlFor="proposta-produtor" className="font-normal cursor-pointer text-sm">
                      Todo envio para o Produtor
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="total_lemoncaps" id="proposta-lemoncaps" />
                    <Label htmlFor="proposta-lemoncaps" className="font-normal cursor-pointer text-sm">
                      Toda logística via Lemon Caps
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="parcial" id="proposta-parcial" />
                    <Label htmlFor="proposta-parcial" className="font-normal cursor-pointer text-sm">
                      Envio Parcial
                    </Label>
                  </div>
                </RadioGroup>

                {detalhamentoEnvio.tipo === 'parcial' && (
                  <div className="ml-6 space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Descreva a divisão:
                    </Label>
                    <Textarea
                      value={detalhamentoEnvio.descricao_parcial || ''}
                      onChange={(e) => setDetalhamentoEnvio(prev => ({ 
                        ...prev, 
                        descricao_parcial: e.target.value 
                      }))}
                      placeholder="Ex: 50 potes para produtor, 100 potes logística Lemon Caps"
                      rows={2}
                    />
                  </div>
                )}
              </div>

              {/* Frete Lemon Caps */}
              <div className="space-y-3 pt-3 border-t">
                <Label className="text-sm">
                  Frete via Lemon Caps para cliente final?
                </Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={freteLemonCaps ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFreteLemonCaps(true)}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    variant={!freteLemonCaps ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFreteLemonCaps(false)}
                  >
                    Não
                  </Button>
                </div>
              </div>

              {freteLemonCaps && (
                <div className="space-y-3">
                  <Label className="text-sm">
                    Usar tabela tradicional de envio?
                  </Label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={usaTabelaTradicional ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUsaTabelaTradicional(true)}
                    >
                      Sim
                    </Button>
                    <Button
                      type="button"
                      variant={!usaTabelaTradicional ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUsaTabelaTradicional(false)}
                    >
                      Não
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleGenerateProposta} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              'Gerar Proposta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
