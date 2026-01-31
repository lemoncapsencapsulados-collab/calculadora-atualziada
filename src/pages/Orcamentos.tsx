import { useState } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { Orcamento } from '@/types/orcamento';
import { generateOrcamentoPDF } from '@/lib/orcamentoGenerator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Download, 
  Pencil, 
  Trash2, 
  Calendar, 
  Package, 
  Palette,
  FileText,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  rascunho: { label: 'Rascunho', variant: 'secondary' },
  enviado: { label: 'Enviado', variant: 'default' },
  aprovado: { label: 'Aprovado', variant: 'outline' },
  recusado: { label: 'Recusado', variant: 'destructive' },
};

export default function Orcamentos() {
  const { orcamentos, isLoading, deleteOrcamento, updateStatus } = useOrcamentos();
  const [searchTerm, setSearchTerm] = useState('');
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [editandoOrcamento, setEditandoOrcamento] = useState<Orcamento | null>(null);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Filtrar orçamentos
  const orcamentosFiltrados = orcamentos.filter(o => {
    const termo = searchTerm.toLowerCase().trim();
    if (!termo) return true;
    return (
      o.nome_cliente.toLowerCase().includes(termo) ||
      o.numero_orcamento.toLowerCase().includes(termo)
    );
  });

  const handleDownloadPDF = async (orcamento: Orcamento) => {
    setDownloadingId(orcamento.id);
    try {
      await generateOrcamentoPDF(orcamento);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletandoId) {
      await deleteOrcamento.mutateAsync(deletandoId);
      setDeletandoId(null);
    }
  };

  const handleStatusChange = async (orcamentoId: string, newStatus: Orcamento['status']) => {
    await updateStatus.mutateAsync({ id: orcamentoId, status: newStatus });
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
              placeholder="Pesquisar por cliente ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de Orçamentos */}
          {orcamentosFiltrados.length === 0 ? (
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
              {orcamentosFiltrados.map((orcamento) => (
                <Card key={orcamento.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 p-4">
                      {/* Informações do Orçamento */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-muted-foreground">
                                {orcamento.numero_orcamento}
                              </span>
                              <Badge variant={STATUS_CONFIG[orcamento.status]?.variant || 'secondary'}>
                                {STATUS_CONFIG[orcamento.status]?.label || orcamento.status}
                              </Badge>
                            </div>
                            <h3 className="font-semibold text-lg text-foreground mt-1">
                              {orcamento.nome_cliente}
                            </h3>
                          </div>
                          
                          {/* Selector de Status */}
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
                            {format(new Date(orcamento.created_at), "dd/MM/yyyy", { locale: ptBR })}
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
                            <p className="font-bold text-primary text-lg">
                              {formatCurrency(orcamento.valor_total)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex lg:flex-col gap-2 justify-end">
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
                          onClick={() => handleDownloadPDF(orcamento)}
                          disabled={downloadingId === orcamento.id}
                        >
                          {downloadingId === orcamento.id ? (
                            <div className="w-4 h-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          PDF
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
              ))}
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
        />
      )}

      {/* Dialog de Confirmação de Exclusão */}
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
