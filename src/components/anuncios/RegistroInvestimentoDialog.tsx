import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUsuarios } from '@/hooks/useUsuarios';
import { CANAIS_VENDAS, OBJETIVOS_CAMPANHA, calcularCPL, diasEntre, formatBRL } from '@/lib/anuncios';
import { AdInvestment, AdInvestmentConsultor, AdInvestmentInput, useAdInvestments } from '@/hooks/useAdInvestments';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  registro?: AdInvestment | null;
}

export default function RegistroInvestimentoDialog({ open, onOpenChange, registro }: Props) {
  const { data: ativos = [] } = useUsuarios(true);
  const { data: todos = [] } = useUsuarios(false);
  const { salvar } = useAdInvestments();

  const [canal, setCanal] = useState<string>(CANAIS_VENDAS[0].id);
  const [objetivo, setObjetivo] = useState<string>(OBJETIVOS_CAMPANHA[0].id);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [investTotal, setInvestTotal] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');
  const [linhas, setLinhas] = useState<AdInvestmentConsultor[]>([]);

  useEffect(() => {
    if (!open) return;
    if (registro) {
      setCanal(registro.canal);
      setObjetivo(registro.objetivo_campanha);
      setDataInicio(registro.data_inicio);
      setDataFim(registro.data_fim);
      setInvestTotal(String(registro.investimento_total));
      setObservacoes(registro.observacoes || '');
      // Merge: ativos + históricos do registro (mesmo desativados)
      const map = new Map<string, AdInvestmentConsultor>();
      for (const u of ativos) {
        map.set(u.id, {
          consultor_id: u.id,
          consultor_nome_snapshot: u.nome,
          leads_recebidos: 0,
          investimento_direcionado: 0,
        });
      }
      for (const c of registro.consultores) {
        const key = c.consultor_id || `snap:${c.consultor_nome_snapshot}`;
        map.set(key, { ...c });
      }
      setLinhas(Array.from(map.values()));
    } else {
      setCanal(CANAIS_VENDAS[0].id);
      setObjetivo(OBJETIVOS_CAMPANHA[0].id);
      setDataInicio('');
      setDataFim('');
      setInvestTotal('');
      setObservacoes('');
      setLinhas(
        ativos.map((u) => ({
          consultor_id: u.id,
          consultor_nome_snapshot: u.nome,
          leads_recebidos: 0,
          investimento_direcionado: 0,
        }))
      );
    }
  }, [open, registro, ativos]);

  const totalInvest = Number(investTotal) || 0;
  const totalLeads = linhas.reduce((s, l) => s + (l.leads_recebidos || 0), 0);
  const totalDistribuido = linhas.reduce((s, l) => s + (l.investimento_direcionado || 0), 0);
  const diferenca = totalInvest - totalDistribuido;
  const ultrapassa = diferenca < -0.005;
  const cpl = calcularCPL(totalInvest, totalLeads);

  const diasResumo = useMemo(() => {
    if (!dataInicio || !dataFim) return '';
    const d = diasEntre(dataInicio, dataFim);
    const fmt = (s: string) => {
      const [y, m, day] = s.split('-');
      return `${day}/${m}/${y}`;
    };
    return `${fmt(dataInicio)} a ${fmt(dataFim)} (${d} dia${d > 1 ? 's' : ''})`;
  }, [dataInicio, dataFim]);

  const atualizarLinha = (idx: number, campo: 'leads_recebidos' | 'investimento_direcionado', valor: number) => {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  };

  const podeSalvar =
    canal &&
    objetivo &&
    dataInicio &&
    dataFim &&
    dataInicio <= dataFim &&
    totalInvest > 0 &&
    !ultrapassa;

  const onSalvar = async () => {
    if (!podeSalvar) {
      toast.error('Preencha os campos obrigatórios corretamente');
      return;
    }
    const input: AdInvestmentInput = {
      id: registro?.id,
      canal,
      data_inicio: dataInicio,
      data_fim: dataFim,
      investimento_total: totalInvest,
      objetivo_campanha: objetivo,
      observacoes,
      consultores: linhas,
    };
    await salvar.mutateAsync(input);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{registro ? 'Editar registro de investimento' : 'Novo registro de investimento'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Canal de Vendas *</Label>
                <Select value={canal} onValueChange={setCanal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANAIS_VENDAS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Objetivo da Campanha *</Label>
                <Select value={objetivo} onValueChange={setObjetivo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBJETIVOS_CAMPANHA.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Data de início *</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Data de fim *</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Investimento Total (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={investTotal}
                  onChange={(e) => setInvestTotal(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            {diasResumo && <p className="text-xs text-muted-foreground">{diasResumo}</p>}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Distribuição por Consultor</Label>
                <div className="text-xs">
                  {ultrapassa ? (
                    <span className="text-destructive font-medium">
                      ⚠️ Valor distribuído ultrapassa o total em {formatBRL(Math.abs(diferenca))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {formatBRL(diferenca)} ainda não distribuídos
                    </span>
                  )}
                </div>
              </div>
              <div className="border rounded-md">
                <div className="grid grid-cols-[1fr_120px_160px] gap-2 p-2 text-xs font-medium border-b bg-muted/40">
                  <div>Consultor</div>
                  <div>Leads recebidos</div>
                  <div>Investimento (R$)</div>
                </div>
                {linhas.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum consultor ativo cadastrado.</p>
                )}
                {linhas.map((l, idx) => {
                  const inativo = l.consultor_id && !ativos.some((u) => u.id === l.consultor_id);
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_120px_160px] gap-2 p-2 border-b last:border-0 items-center">
                      <div className="text-sm flex items-center gap-2">
                        {l.consultor_nome_snapshot}
                        {inativo && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
                      </div>
                      <Input
                        type="number"
                        min="0"
                        value={l.leads_recebidos || ''}
                        onChange={(e) => atualizarLinha(idx, 'leads_recebidos', Number(e.target.value) || 0)}
                        className="h-8"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.investimento_direcionado || ''}
                        onChange={(e) => atualizarLinha(idx, 'investimento_direcionado', Number(e.target.value) || 0)}
                        className="h-8"
                      />
                    </div>
                  );
                })}
                <div className="grid grid-cols-[1fr_120px_160px] gap-2 p-2 bg-muted/40 text-sm font-medium">
                  <div>Totais · CPL: {formatBRL(cpl)}</div>
                  <div>{totalLeads}</div>
                  <div>{formatBRL(totalDistribuido)}</div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSalvar} disabled={!podeSalvar || salvar.isPending}>
            {salvar.isPending ? 'Salvando...' : 'Salvar Registro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
