import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useFunilTrafego } from '@/hooks/useFunilTrafego';
import { CabecalhoTrafego } from '@/components/trafego/CabecalhoTrafego';
import { VisaoGeralTrafego } from '@/components/trafego/VisaoGeralTrafego';
import { HierarquiaAnuncios } from '@/components/trafego/HierarquiaAnuncios';
import { CriativosPainel } from '@/components/trafego/CriativosPainel';
import { SecaoPendente } from '@/components/trafego/SecaoPendente';
import { EventosMeta } from '@/components/trafego/EventosMeta';

/**
 * Funis de Tráfego Pago — fase C.
 *
 * Três blocos construídos (visão geral, hierarquia, criativos) e dois
 * declarados vazios. Os dois que faltam não estão escondidos nem prometidos:
 * estão na tela, dizendo de que fonte dependem. Estado, não promessa.
 */

interface ConsultaTabela {
  select(colunas: string): ConsultaTabela;
  eq(coluna: string, valor: unknown): ConsultaTabela;
  then: Promise<{ data: unknown; error: { message: string } | null }>['then'];
}
interface ClienteTabela {
  from(tabela: string): ConsultaTabela;
}

/** Contas com coleta em nível de anúncio ligada. A lista sai do banco em vez de
 *  ser fixa no código para "só a da Lemon Caps" continuar verdadeiro quando
 *  alguém ligar outra conta. */
function useContasColetadas() {
  return useQuery({
    queryKey: ['trafego-contas'],
    queryFn: async () => {
      // `coletar_nivel_ad` é coluna nova e ainda não está nos tipos gerados;
      // o escape fica restrito a esta consulta.
      const { data, error } = await (supabase as unknown as ClienteTabela)
        .from('meta_ad_accounts')
        .select('ad_account_id, nome, coletar_nivel_ad')
        .eq('ativo', true)
        .eq('coletar_nivel_ad', true);
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ ad_account_id: string; nome: string | null }>;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export default function FunisTrafegoPago() {
  const [mes, setMes] = useState(() => format(new Date(), 'yyyy-MM'));
  const [conta, setConta] = useState<string | null>(null);

  const { data: contas = [] } = useContasColetadas();

  const filtros = useMemo(() => {
    const referencia = parseISO(`${mes}-01`);
    return {
      inicio: format(startOfMonth(referencia), 'yyyy-MM-dd'),
      fim: format(endOfMonth(referencia), 'yyyy-MM-dd'),
      // Sem escolha explícita, usa a única conta coletada — que é o caso normal
      // hoje. Com mais de uma, o seletor decide.
      conta: conta ?? (contas.length === 1 ? contas[0].ad_account_id : null),
    };
  }, [mes, conta, contas]);

  const { atual, anterior, criativos, eventos, status, carregando, erro } =
    useFunilTrafego(filtros);

  const nomeConta =
    contas.find((c) => c.ad_account_id === filtros.conta)?.nome ?? null;

  return (
    <div className="min-h-screen">
      <div className="container mx-auto space-y-6 px-4 py-6">
        <CabecalhoTrafego
          inicio={filtros.inicio}
          fim={filtros.fim}
          conta={filtros.conta}
          nomeConta={nomeConta}
          atual={atual}
          status={status}
        />

        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="mes-trafego">Mês</Label>
            <Input
              id="mes-trafego"
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-44"
            />
          </div>

          {contas.length > 1 && (
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Select
                value={conta ?? 'todas'}
                onValueChange={(v) => setConta(v === 'todas' ? null : v)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as contas coletadas</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.ad_account_id} value={c.ad_account_id}>
                      {c.nome ?? c.ad_account_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {erro && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {erro.message}
          </p>
        )}

        {contas.length === 0 && !carregando && (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhuma conta está marcada para coleta em nível de anúncio. Ligue
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-xs">
              coletar_nivel_ad
            </code>
            na conta desejada em <span className="font-medium">meta_ad_accounts</span>.
          </p>
        )}

        <VisaoGeralTrafego atual={atual} anterior={anterior} />

        <HierarquiaAnuncios filtros={filtros} />

        <CriativosPainel criativos={criativos} />

        <EventosMeta eventos={eventos} />

        <SecaoPendente
          titulo="Comportamento no site"
          motivo="A landing page tem GTM instalado, mas o GTM expõe configuração — tags, gatilhos, variáveis — e nenhuma métrica. Sem GA4 não há histórico de evento de site, e o Clarity só devolve os últimos 1 a 3 dias por coleta."
          destrava="GA4 na landing (histórico de evento) e/ou Clarity com cron diário de acúmulo."
        />

        <SecaoPendente
          titulo="Qualidade do lead"
          motivo="Responder se o lead barato é lead bom exige ligar a conversa de WhatsApp ao anúncio que a originou. Hoje o formulário da landing vai para o n8n e nada da origem chega ao banco — não há como saber de qual campanha veio cada conversa."
          destrava="GTM injetando fbclid/utm no formulário e um nó do n8n gravando a submissão, com telefone, numa tabela nossa."
        />
      </div>
    </div>
  );
}
