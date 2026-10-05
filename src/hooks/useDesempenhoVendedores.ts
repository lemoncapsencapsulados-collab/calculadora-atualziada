import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DesempenhoVendedor, ResultadoMes } from '@/lib/desempenhoVendedor';
import { type ConsultorCadastrado, resolverConsultor } from '@/lib/nomeConsultor';

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

      // O cadastro e' o que junta as tres grafias do mesmo vendedor: o nome
      // digitado no orcamento, o nome da instancia do WhatsApp e o nome do
      // cadastro. Sem isto a mesma pessoa vira duas linhas, cada uma com
      // metade dos numeros.
      const { data: usuarios } = await supabase.from('usuarios').select('id, nome');
      const { data: instancias } = await supabase
        .from('zap_instancias')
        .select('instance_name, usuario_id');

      const cadastro: ConsultorCadastrado[] = (usuarios || []).map((u) => ({
        nome: (u.nome as string) || '',
        instancia:
          (instancias || []).find((i) => i.usuario_id === u.id)?.instance_name ?? null,
      }));

      const { data: orcamentos, error } = await supabase
        .from('orcamentos')
        .select('consultor_responsavel, tipo_orcamento, status, valor_total, created_at')
        .gte('created_at', desde.toISOString());
      if (error) throw error;

      // Leads: conversas NOVAS no WhatsApp. O funil é um formulário -- o
      // cliente preenche, deixa o número, e a conversa começa --, então o lead
      // nasce na primeira mensagem trocada com aquele número.
      //
      // Vem da visão `zap_leads_por_mes`, que agrega no banco. Antes isto saía
      // de `zap_contatos.created_at`, que é a data em que a sincronização
      // gravou a linha: os 2.259 contatos tinham três datas só, e a coluna
      // mostrava 1.377 leads num dia de agosto e zero no resto.
      const { data: leadsPorMes } = await supabase
        .from('zap_leads_por_mes' as never)
        .select('instance_name, mes, leads')
        .gte('mes', desde.toISOString().slice(0, 10));

      const { data: ultimaMensagem } = await supabase
        .from('zap_mensagens')
        .select('momento')
        .order('momento', { ascending: false })
        .limit(1);

      const porVendedor = new Map<string, Map<string, ResultadoMes>>();
      const meses = new Set<string>();

      const pegar = (vendedor: string, mes: string): ResultadoMes => {
        const nome = resolverConsultor(vendedor, cadastro) || 'Sem consultor';
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

      for (const l of (leadsPorMes || []) as unknown as {
        instance_name: string;
        mes: string;
        leads: number;
      }[]) {
        // `mes` já vem como o primeiro dia do mês; a chave é AAAA-MM.
        pegar(l.instance_name, String(l.mes).slice(0, 7)).leads += Number(l.leads) || 0;
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
