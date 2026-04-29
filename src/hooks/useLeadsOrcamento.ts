import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Orcamento } from '@/types/orcamento';
import { Cliente } from '@/hooks/useClientes';

export interface LeadOrcamento {
  key: string;
  cliente_id?: string;
  cliente?: Cliente;
  nome: string;
  telefone: string;
  email?: string;
  total_orcamentos: number;
  valor_total_acumulado: number;
  ultimo_orcamento_em: string;
  consultor_recente?: string;
  orcamentos: Orcamento[];
}

function parseOrcamento(row: any): Orcamento {
  return {
    ...row,
    itens_producao: row.itens_producao || [],
    servicos_marca: row.servicos_marca || [],
    dados_cliente: row.dados_cliente || {},
    detalhamento_frete: row.detalhamento_frete || {},
  } as Orcamento;
}

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useLeadsOrcamento() {
  return useQuery({
    queryKey: ['leads-orcamento'],
    queryFn: async (): Promise<LeadOrcamento[]> => {
      const { data: orcs, error } = await supabase
        .from('orcamentos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const orcamentos = (orcs || []).map(parseOrcamento);

      // Coletar IDs de cliente distintos
      const clienteIds = Array.from(
        new Set(orcamentos.map((o: any) => o.cliente_id).filter(Boolean))
      ) as string[];

      let clientesMap = new Map<string, Cliente>();
      if (clienteIds.length > 0) {
        const { data: clis } = await supabase
          .from('clientes')
          .select('*')
          .in('id', clienteIds);
        (clis || []).forEach((c: any) => clientesMap.set(c.id, c as Cliente));
      }

      // Agrupar
      const groups = new Map<string, LeadOrcamento>();
      for (const orc of orcamentos) {
        const cid = (orc as any).cliente_id as string | undefined;
        const cliente = cid ? clientesMap.get(cid) : undefined;
        const key = cid || `nome:${normalize(orc.nome_cliente)}`;

        const nome = cliente?.nome || orc.nome_cliente;
        const telefone = cliente?.telefone || (orc.dados_cliente?.telefone as string) || '';
        const email = cliente?.email || (orc.dados_cliente?.email as string) || undefined;

        if (!groups.has(key)) {
          groups.set(key, {
            key,
            cliente_id: cid,
            cliente,
            nome,
            telefone,
            email,
            total_orcamentos: 0,
            valor_total_acumulado: 0,
            ultimo_orcamento_em: orc.created_at,
            consultor_recente: orc.consultor_responsavel,
            orcamentos: [],
          });
        }
        const g = groups.get(key)!;
        g.orcamentos.push(orc);
        g.total_orcamentos += 1;
        g.valor_total_acumulado += Number(orc.valor_total) || 0;
        if (new Date(orc.created_at) > new Date(g.ultimo_orcamento_em)) {
          g.ultimo_orcamento_em = orc.created_at;
          g.consultor_recente = orc.consultor_responsavel;
        }
      }

      // Ordenar por orçamento mais recente
      return Array.from(groups.values()).sort(
        (a, b) => new Date(b.ultimo_orcamento_em).getTime() - new Date(a.ultimo_orcamento_em).getTime()
      );
    },
  });
}
