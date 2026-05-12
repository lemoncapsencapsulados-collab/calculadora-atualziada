import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History } from 'lucide-react';
import HistoricoPagamentoLista from '@/components/pedidos/HistoricoPagamentoLista';

interface AlteracaoPedido {
  id: string;
  numero_pedido: string;
  nome_cliente: string;
  consultor: string;
  alteracoes: any[];
}

interface Props {
  dados: AlteracaoPedido[];
}

export function DashboardAlteracoesPagamento({ dados }: Props) {
  if (!dados || dados.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-4 h-4 text-amber-700" />
          Alterações de pagamento no período ({dados.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dados.map((p) => (
          <div key={p.id} className="border rounded-md p-3 bg-amber-50/40">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="text-sm font-semibold">
                {p.numero_pedido} · {p.nome_cliente}
              </div>
              <div className="text-xs text-muted-foreground">Consultor: {p.consultor}</div>
            </div>
            <HistoricoPagamentoLista alteracoes={p.alteracoes} compact />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default DashboardAlteracoesPagamento;