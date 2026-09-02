import { AlertTriangle, Database } from 'lucide-react';
import type { PeriodoTrafego, StatusColeta } from '@/hooks/useFunilTrafego';

/**
 * A página abre dizendo de que período e de qual conta fala.
 *
 * Não é enfeite: sem isso, um número na tela é uma afirmação sem sujeito. A base
 * (N) fica ao lado do período pelo mesmo motivo — "conversão de 12%" sem N é
 * enganoso, e aqui o N é quantos anúncios e quantos leads sustentam a leitura.
 */

function dataBR(iso: string): string {
  return iso.split('-').reverse().join('/');
}

function haQuantoTempo(quando: string | null): string {
  if (!quando) return 'nunca coletado';
  const min = Math.round((Date.now() - new Date(quando).getTime()) / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h}h`;
  return `há ${Math.round(h / 24)} dias`;
}

interface Props {
  inicio: string;
  fim: string;
  conta: string | null;
  nomeConta: string | null;
  atual: PeriodoTrafego | null;
  status: StatusColeta | null;
}

export function CabecalhoTrafego({ inicio, fim, conta, nomeConta, atual, status }: Props) {
  const defasado =
    status?.dia_mais_recente != null && status.dia_mais_recente < fim ? status.dia_mais_recente : null;

  return (
    <header className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Funis de Tráfego Pago</h1>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className="font-mono">
          {dataBR(inicio)} — {dataBR(fim)}
        </span>
        <span aria-hidden>·</span>
        <span>{nomeConta ?? conta ?? 'todas as contas coletadas'}</span>

        {atual && (
          <>
            <span aria-hidden>·</span>
            <span className="font-mono">
              N={atual.anuncios.toLocaleString('pt-BR')} anúncios
            </span>
            <span aria-hidden>·</span>
            <span className="font-mono">{atual.leads.toLocaleString('pt-BR')} leads</span>
          </>
        )}

        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Database className="h-3.5 w-3.5" />
          coleta {haQuantoTempo(status?.ultima_coleta ?? null)}
        </span>
      </div>

      {/* Dado defasado precisa ser dito, não descoberto: sem este aviso alguém
          leria uma queda de investimento que é só coleta atrasada. */}
      {defasado && (
        <p className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Coleta vai até {dataBR(defasado)}. Os dias seguintes ainda não entraram — o
          período exibido está incompleto.
        </p>
      )}

      {status && status.jobs_em_erro > 0 && (
        <p className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {status.jobs_em_erro} janela(s) de coleta falharam em definitivo. Há buraco no
          histórico até serem reprocessadas.
        </p>
      )}
    </header>
  );
}
