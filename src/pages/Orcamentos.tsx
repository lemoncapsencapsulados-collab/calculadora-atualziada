import { useState, useEffect } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useOrcamentosPaginados } from '@/hooks/useOrcamentosPaginados';
import { Orcamento } from '@/types/orcamento';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Pencil, 
  Trash2, 
  Calendar, 
  Package, 
  Palette,
  FileText,
  Plus,
  CheckCircle2,
  FileCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import GerarOrcamentoDialog from '@/components/GerarOrcamentoDialog';
import PreviewPdfDialog from '@/components/PreviewPdfDialog';
import PropostaCompletaDialog from '@/components/PropostaCompletaDialog';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  rascunho: { label: 'Rascunho', variant: 'secondary' },
  enviado: { label: 'Enviado', variant: 'default' },
  aprovado: { label: 'Aprovado', variant: 'outline' },
  recusado: { label: 'Recusado', variant: 'destructive' },
};

const PAGE_SIZE = 15;

export default function Orcamentos() {
  const queryClient = useQueryClient();
  const { deleteOrcamento, updateStatus } = useOrcamentos();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [editandoOrcamento, setEditandoOrcamento] = useState<Orcamento | null>(null);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [previewOrcamento, setPreviewOrcamento] = useState<Orcamento | null>(null);
  const [propostaCompletaOrcamento, setPropostaCompletaOrcamento] = useState<Orcamento | null>(null);

  const { orcamentos, totalCount, totalPages, isLoading } = useOrcamentosPaginados({
    page: currentPage,
    pageSize: PAGE_SIZE,
    searchTerm,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const invalidatePaginated = () => {
    queryClient.invalidateQueries({ queryKey: ['orcamentos-paginados'] });
  };

  const handleConfirmDelete = async () => {
    if (deletandoId) {
      await deleteOrcamento.mutateAsync(deletandoId);
      setDeletandoId(null);
      invalidatePaginated();
    }
  };

  const handleStatusChange = async (orcamentoId: string, newStatus: Orcamento['status']) => {
    await updateStatus.mutateAsync({ id: orcamentoId, status: newStatus });
    invalidatePaginated();
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando orçamentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                Orçamentos Gerados
              </CardTitle>
              <CardDescription>
                Gerencie todos os orçamentos comerciais
              </CardDescription>
            </div>
            <Button onClick={() => setCriandoNovo(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Orçamento
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Campo de Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar por cliente, consultor ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de Orçamentos */}
          {orcamentos.length === 0 ? (
            <div className="py-12 text-center border rounded-lg bg-muted/30">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'Nenhum orçamento encontrado.' : 'Nenhum orçamento gerado ainda.'}
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setCriandoNovo(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Orçamento
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {orcamentos.map((orcamento) => {
                const isAprovado = orcamento.status === 'aprovado';
                
                return (
                  <Card 
                    key={orcamento.id} 
                    className={`overflow-hidden transition-all ${
                      isAprovado 
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20 shadow-green-100 dark:shadow-green-900/20 shadow-md' 
                        : ''
                    }`}
                  >
                    <CardContent className="p-0">
                      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 p-4">
                        {/* Informações do Orçamento */}
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-lg">
                                  {orcamento.consultor_responsavel || 'Sem consultor'}
                                </span>
                                <Badge variant={STATUS_CONFIG[orcamento.status]?.variant || 'secondary'}>
                                  {STATUS_CONFIG[orcamento.status]?.label || orcamento.status}
                                </Badge>
                                {isAprovado && (
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                )}
                              </div>
                              <p className="text-muted-foreground text-sm mt-1">
                                Cliente: <span className="font-medium text-foreground">{orcamento.nome_cliente}</span>
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {orcamento.numero_orcamento}
                              </p>
                            </div>
                            
                            <Select
                              value={orcamento.status}
                              onValueChange={(value) => handleStatusChange(orcamento.id, value as Orcamento['status'])}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="rascunho">Rascunho</SelectItem>
                                <SelectItem value="enviado">Enviado</SelectItem>
                                <SelectItem value="aprovado">Aprovado</SelectItem>
                                <SelectItem value="recusado">Recusado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Data e Resumo */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(orcamento.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </div>
                            <div className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {orcamento.itens_producao?.length || 0} produto(s)
                            </div>
                            <div className="flex items-center gap-1">
                              <Palette className="w-3 h-3" />
                              {orcamento.servicos_marca?.length || 0} serviço(s)
                            </div>
                          </div>

                          {/* Valores */}
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Produção</p>
                              <p className="font-medium">{formatCurrency(orcamento.subtotal_producao)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Serviços</p>
                              <p className="font-medium">{formatCurrency(orcamento.subtotal_servicos)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Total</p>
                              <p className={`font-bold text-lg ${isAprovado ? 'text-green-600' : 'text-primary'}`}>
                                {formatCurrency(orcamento.valor_total)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex lg:flex-col gap-2 justify-end flex-wrap">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditandoOrcamento(orcamento)}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setPreviewOrcamento(orcamento)}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Gerar Orçamento
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => setPropostaCompletaOrcamento(orcamento)}
                          >
                            <FileCheck className="w-4 h-4 mr-2" />
                            Proposta Completa
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => setDeletandoId(orcamento.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    {totalCount} resultado{totalCount !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => p - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage >= totalPages}
                    >
                      Próxima
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Criação/Edição */}
      {(criandoNovo || editandoOrcamento) && (
        <GerarOrcamentoDialog
          orcamentoExistente={editandoOrcamento}
          onClose={() => {
            setCriandoNovo(false);
            setEditandoOrcamento(null);
          }}
          onSuccess={invalidatePaginated}
        />
      )}

      {/* Dialog de Preview do PDF */}
      {previewOrcamento && (
        <PreviewPdfDialog
          orcamento={previewOrcamento}
          onClose={() => setPreviewOrcamento(null)}
        />
      )}

      {/* Dialog de Proposta Completa */}
      {propostaCompletaOrcamento && (
        <PropostaCompletaDialog
          orcamento={propostaCompletaOrcamento}
          onClose={() => setPropostaCompletaOrcamento(null)}
        />
      )}

      <AlertDialog open={!!deletandoId} onOpenChange={(open) => !open && setDeletandoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
