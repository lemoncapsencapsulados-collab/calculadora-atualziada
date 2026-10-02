import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DesempenhoVendedor, ResultadoMes } from '@/lib/desempenhoVendedor';

/**
 * Números de cada vendedor, mês a mês.
 *
 * Vem de `orcamentos`, que é a fonte viva: o orçamento guarda quem vendeu, de
 * que tipo foi e se foi pago. Os leads vêm de `zap_contatos`, que depende da
 * sincronização do WhatsApp -- quando ela para, o número para junto, e por isso
 * o hook devolve até quando há conversa registrada. Mostrar zero sem avisar
 * seria dizer que o vendedor não recebeu ninguém.
 */

/** AAAA-MM do mês, no fuso local. */
const chaveMes = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function mesVazio(mes: string): ResultadoMes {
  return {
    mes,
    leads: 0,
    orcamentos: 0,
    valorPrimeirasVendas: 0,
    valorRecompras: 0,
    vendasNovas: 0,
    recompras: 0,
  };
}

export interface DadosDesempenho {
  vendedores: DesempenhoVendedor[];
  /** Todos os meses presentes, do mais antigo ao mais novo. */
  meses: string[];
  /** Último mês com mensagem de WhatsApp gravada; null quando não há nenhuma. */
  ultimoMesComConversa: string | null;
}

export function useDesempenhoVendedores(mesesParaTras = 6) {
  return useQuery<DadosDesempenho>({
    queryKey: ['desempenho-vendedores', mesesParaTras],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - mesesParaTras);
      desde.setDate(1);
      desde.setHours(0, 0, 0, 0);

      const { data: orcamentos, error } = await supabase
        .from('orcamentos')
        .select('consultor_responsavel, tipo_orcamento, status, valor_total, created_at')
        .gte('created_at', desde.toISOString());
      if (error) throw error;

      // Leads: contatos novos por vendedor. A instância do WhatsApp é o
      // vendedor, então o nome dela é a chave de ligação.
      const { data: contatos } = await supabase
        .from('zap_contatos')
        .select('instance_name, created_at')
        .gte('created_at', desde.toISOString());

      const { data: ultimaMensagem } = await supabase
        .from('zap_mensagens')
        .select('momento')
        .order('momento', { ascending: false })
        .limit(1);

      const porVendedor = new Map<string, Map<string, ResultadoMes>>();
      const meses = new Set<string>();

      const pegar = (vendedor: string, mes: string): ResultadoMes => {
        const nome = (vendedor || '').trim() || 'Sem consultor';
        if (!porVendedor.has(nome)) porVendedor.set(nome, new Map());
        const doVendedor = porVendedor.get(nome)!;
        if (!doVendedor.has(mes)) doVendedor.set(mes, mesVazio(mes));
        meses.add(mes);
        return doVendedor.get(mes)!;
      };

      for (const o of orcamentos || []) {
        const mes = chaveMes(o.created_at as string);
        const r = pegar(o.consultor_responsavel as string, mes);
        r.orcamentos += 1;

        if (o.status !== 'pago') continue;
        const valor = Number(o.valor_total) || 0;
        if (o.tipo_orcamento === 'recompra') {
          r.recompras += 1;
          r.valorRecompras += valor;
        } else {
          r.vendasNovas += 1;
          r.valorPrimeirasVendas += valor;
        }
      }

      for (const c of contatos || []) {
        const mes = chaveMes(c.created_at as string);
        pegar(c.instance_name as string, mes).leads += 1;
      }

      const ordenados = Array.from(meses).sort();

      const vendedores: DesempenhoVendedor[] = Array.from(porVendedor.entries())
        .map(([vendedor, porMes]) => ({
          vendedor,
          // Preenche mês sem movimento: um buraco no meio da série faria a
          // comparação pular de julho para setembro sem ninguém notar.
          meses: ordenados.map((m) => porMes.get(m) ?? mesVazio(m)),
        }))
        .sort((a, b) => a.vendedor.localeCompare(b.vendedor, 'pt-BR'));

      const momento = ultimaMensagem?.[0]?.momento as string | undefined;

      return {
        vendedores,
        meses: ordenados,
        ultimoMesComConversa: momento ? chaveMes(momento) : null,
      };
    },
  });
}
