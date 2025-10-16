import { useState, useMemo } from 'react';
import { usePedidos } from '@/hooks/usePedidos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  FileText, 
  Trash2, 
  Download, 
  Clock, 
  Package, 
  Truck, 
  CheckCircle2,
  Calendar,
  Info
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { gerarPDFOrdemProducao } from '@/lib/pdfGenerator';
import { StatusPedido } from '@/types/formula';

const Pedidos = () => {
  const { pedidos, loading, updateStatus, deletePedido } = usePedidos();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusConfig = (status: StatusPedido) => {
    const configs = {
      aguardando_producao: {
        label: 'Aguardando Produção',
        icon: Clock,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      },
      no_estoque: {
        label: 'No Estoque',
        icon: Package,
        color: 'bg-blue-100 text-blue-800 border-blue-300',
      },
      enviado: {
        label: 'Enviado',
        icon: Truck,
        color: 'bg-purple-100 text-purple-800 border-purple-300',
      },
      concluido: {
        label: 'Concluído',
        icon: CheckCircle2,
        color: 'bg-green-100 text-green-800 border-green-300',
      },
    };
    return configs[status];
  };

  const filteredPedidos = useMemo(() => {
    return pedidos.filter((pedido) => {
      const matchesSearch =
        pedido.numero_pedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.formula_snapshot.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.formula_snapshot.nome_formula.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'todos' || pedido.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [pedidos, searchTerm, filterStatus]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Carregando pedidos...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Pedidos Gerados
          </CardTitle>
          <CardDescription>
            Acompanhe e gerencie as ordens de produção
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, cliente ou produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filterStatus === 'todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('todos')}
            >
              Todos ({pedidos.length})
            </Button>
            {(['aguardando_producao', 'no_estoque', 'enviado', 'concluido'] as StatusPedido[]).map((status) => {
              const config = getStatusConfig(status);
              const count = pedidos.filter(p => p.status === status).length;
              const StatusIcon = config.icon;
              
              return (
                <Button
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                >
                  <StatusIcon className="h-4 w-4 mr-1" />
                  {config.label} ({count})
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPedidos.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {searchTerm || filterStatus !== 'todos'
                  ? 'Nenhum pedido encontrado'
                  : 'Nenhum pedido gerado ainda'}
              </p>
              <p className="text-sm mt-2">
                {!searchTerm && filterStatus === 'todos' && 
                  'Crie pedidos a partir das cotações salvas'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPedidos.map((pedido) => {
            const statusConfig = getStatusConfig(pedido.status);
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={pedido.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-base">{pedido.numero_pedido}</CardTitle>
                      <CardDescription className="text-sm">
                        {pedido.formula_snapshot.cliente}
                      </CardDescription>
                    </div>
                    <Badge className={`${statusConfig.color} flex items-center gap-1 px-2 py-1`}>
                      <StatusIcon className="h-3 w-3" />
                      <span className="text-xs">{statusConfig.label}</span>
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{pedido.formula_snapshot.nome_formula}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>Entrega: {format(pedido.data_entrega, 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-muted-foreground">Quantidade:</span>
                      <span className="font-semibold">
                        {pedido.quantidade_produto} {pedido.unidade_produto}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Custo Total:</span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(pedido.formula_snapshot.custo_total)}
                      </span>
                    </div>
                  </div>

                  {pedido.observacoes && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-yellow-900 mb-1">Observações:</p>
                          <p className="text-xs text-yellow-800 whitespace-pre-line line-clamp-3">
                            {pedido.observacoes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t">
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Status do Pedido:
                    </Label>
                    <Select
                      value={pedido.status}
                      onValueChange={(newStatus) => 
                        updateStatus({ id: pedido.id, status: newStatus as StatusPedido })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['aguardando_producao', 'no_estoque', 'enviado', 'concluido'] as StatusPedido[]).map((status) => {
                          const config = getStatusConfig(status);
                          const Icon = config.icon;
                          return (
                            <SelectItem key={status} value={status}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {config.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => gerarPDFOrdemProducao(pedido)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar Ordem de Produção
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o pedido {pedido.numero_pedido}? 
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePedido(pedido.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Pedidos;
