import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useUsuarios } from '@/hooks/useUsuarios';
import { CANAIS_VENDAS, OBJETIVOS_CAMPANHA, calcularCPL, diasEntre, formatBRL } from '@/lib/anuncios';
import { AdInvestment, AdInvestmentConsultor, AdInvestmentInput, useAdInvestments } from '@/hooks/useAdInvestments';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  registro?: AdInvestment | null;
  registrosPeriodo?: AdInvestment[];
  periodoLabel?: string;
}

export default function RegistroInvestimentoDialog({ open, onOpenChange, registro, registrosPeriodo = [], periodoLabel }: Props) {
  const { data: ativos = [] } = useUsuarios(true);
  const { salvar } = useAdInvestments();

  const [nomeCampanha, setNomeCampanha] = useState('');
  const [canal, setCanal] = useState<string>(CANAIS_VENDAS[0].id);
  const [objetivo, setObjetivo] = useState<string>(OBJETIVOS_CAMPANHA[0].id);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [linhas, setLinhas] = useState<AdInvestmentConsultor[]>([]);

  useEffect(() => {
    if (!open) return;
    if (registro) {
      setNomeCampanha(registro.nome_campanha || '');
      setCanal(registro.canal);
      setObjetivo(registro.objetivo_campanha);
      setDataInicio(registro.data_inicio);
      setDataFim(registro.data_fim);
      setObservacoes(registro.observacoes || '');
      setLinhas(registro.consultores.map((c) => ({ ...c })));
    } else {
      setNomeCampanha('');
      setCanal(CANAIS_VENDAS[0].id);
      setObjetivo(OBJETIVOS_CAMPANHA[0].id);
      setDataInicio('');
      setDataFim('');
      setObservacoes('');
      setLinhas([]);
    }
  }, [open, registro]);

  const totalLeads = linhas.reduce((s, l) => s + (l.leads_recebidos || 0), 0);
  const totalCampanha = linhas.reduce((s, l) => s + (l.investimento_direcionado || 0), 0);
  const cpl = calcularCPL(totalCampanha, totalLeads);

  const diasResumo = useMemo(() => {
    if (!dataInicio || !dataFim) return '';
    const d = diasEntre(dataInicio, dataFim);
    const fmt = (s: string) => {
      const [y, m, day] = s.split('-');
      return `${day}/${m}/${y}`;
    };
    return `${fmt(dataInicio)} a ${fmt(dataFim)} (${d} dia${d > 1 ? 's' : ''})`;
  }, [dataInicio, dataFim]);

  const atualizarLinha = (idx: number, patch: Partial<AdInvestmentConsultor>) => {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const adicionarLinha = () => {
    setLinhas((prev) => [
      ...prev,
      { consultor_id: null, consultor_nome_snapshot: '', leads_recebidos: 0, investimento_direcionado: 0 },
    ]);
  };
  const removerLinha = (idx: number) => {
    setLinhas((prev) => prev.filter((_, i) => i !== idx));
  };
  const escolherConsultor = (idx: number, userId: string) => {
    const u = ativos.find((a) => a.id === userId);
    if (!u) return;
    atualizarLinha(idx, { consultor_id: u.id, consultor_nome_snapshot: u.nome });
  };

  const linhasValidas = linhas.filter((l) => l.consultor_id && (l.investimento_direcionado > 0 || l.leads_recebidos > 0));
  const podeSalvar =
    !!nomeCampanha.trim() &&
    !!canal &&
    !!objetivo &&
    !!dataInicio &&
    !!dataFim &&
    dataInicio <= dataFim &&
    linhasValidas.length > 0;

  // Painel Geral: soma acumulada do período + linhas atuais em edição (exceto o próprio registro em edição)
  const painelGeral = useMemo(() => {
    const map = new Map<string, { nome: string; leads: number; invest: number }>();
    for (const r of registrosPeriodo) {
      if (registro && r.id === registro.id) continue;
      for (const c of r.consultores) {
        const key = (c.consultor_id || `snap:${c.consultor_nome_snapshot}`).toLowerCase();
        const cur = map.get(key) || { nome: c.consultor_nome_snapshot, leads: 0, invest: 0 };
        cur.leads += c.leads_recebidos || 0;
        cur.invest += c.investimento_direcionado || 0;
        map.set(key, cur);
      }
    }
    for (const c of linhas) {
      if (!c.consultor_id && !c.consultor_nome_snapshot) continue;
      const key = (c.consultor_id || `snap:${c.consultor_nome_snapshot}`).toLowerCase();
      const cur = map.get(key) || { nome: c.consultor_nome_snapshot, leads: 0, invest: 0 };
      cur.leads += c.leads_recebidos || 0;
      cur.invest += c.investimento_direcionado || 0;
      map.set(key, cur);
    }
    const linhasG = Array.from(map.values()).sort((a, b) => b.invest - a.invest);
    const totLeads = linhasG.reduce((s, l) => s + l.leads, 0);
    const totInvest = linhasG.reduce((s, l) => s + l.invest, 0);
    return { linhas: linhasG, totLeads, totInvest };
  }, [registrosPeriodo, linhas, registro]);

  const onSalvar = async () => {
    if (!podeSalvar) {
      toast.error('Preencha os campos obrigatórios corretamente');
      return;
    }
    const input: AdInvestmentInput = {
      id: registro?.id,
      nome_campanha: nomeCampanha.trim(),
      canal,
      data_inicio: dataInicio,
      data_fim: dataFim,
      investimento_total: totalCampanha,
      objetivo_campanha: objetivo,
      observacoes,
      consultores: linhasValidas,
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

        <div className="min-h-0 flex-1 overflow-y-auto pr-3">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome da Campanha *</Label>
              <Input
                value={nomeCampanha}
                onChange={(e) => setNomeCampanha(e.target.value)}
                placeholder="Ex: Emagrecimento - Junho 2026"
                maxLength={120}
              />
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data de início *</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Data de fim *</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
            {diasResumo && <p className="text-xs text-muted-foreground">{diasResumo}</p>}

            {/* Painel Geral acumulado do período */}
            <div className="border rounded-md bg-muted/30">
              <div className="flex items-center justify-between p-2 border-b">
                <div className="text-sm font-semibold">
                  Geral do período{periodoLabel ? ` (${periodoLabel})` : ''}
                </div>
                <div className="text-xs text-muted-foreground">
                  Soma de todas as campanhas + o que está sendo digitado
                </div>
              </div>
              {painelGeral.linhas.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Nenhum dado no período.</p>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_100px_140px_100px] gap-2 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    <div>Consultor</div>
                    <div className="text-right">Leads</div>
                    <div className="text-right">Investimento</div>
                    <div className="text-right">CPL</div>
                  </div>
                  {painelGeral.linhas.map((l) => (
                    <div key={l.nome} className="grid grid-cols-[1fr_100px_140px_100px] gap-2 px-2 py-1 text-sm border-t">
                      <div className="truncate">{l.nome || '—'}</div>
                      <div className="text-right">{l.leads}</div>
                      <div className="text-right">{formatBRL(l.invest)}</div>
                      <div className="text-right">{formatBRL(calcularCPL(l.invest, l.leads))}</div>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr_100px_140px_100px] gap-2 px-2 py-1 text-sm font-semibold border-t bg-muted/50">
                    <div>Total Geral</div>
                    <div className="text-right">{painelGeral.totLeads}</div>
                    <div className="text-right">{formatBRL(painelGeral.totInvest)}</div>
                    <div className="text-right">{formatBRL(calcularCPL(painelGeral.totInvest, painelGeral.totLeads))}</div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Dados por Campanha</Label>
                <span className="text-xs text-muted-foreground">
                  Total desta campanha: {formatBRL(totalCampanha)} · {totalLeads} leads · CPL {formatBRL(cpl)}
                </span>
              </div>
              <div className="border rounded-md">
                <div className="grid grid-cols-[1fr_110px_140px_40px] gap-2 p-2 text-xs font-medium border-b bg-muted/40">
                  <div>Consultor</div>
                  <div>Leads recebidos</div>
                  <div>Investimento (R$)</div>
                  <div />
                </div>
                {linhas.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">Adicione um consultor para começar.</p>
                )}
                {linhas.map((l, idx) => {
                  const inativo = l.consultor_id && !ativos.some((u) => u.id === l.consultor_id);
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_110px_140px_40px] gap-2 p-2 border-b last:border-0 items-center">
                      <div className="flex items-center gap-2">
                        <Select
                          value={l.consultor_id || ''}
                          onValueChange={(v) => escolherConsultor(idx, v)}
                        >
                          <SelectTrigger className="h-8"><SelectValue placeholder="Selecionar consultor" /></SelectTrigger>
                          <SelectContent>
                            {ativos.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                            ))}
                            {inativo && l.consultor_id && (
                              <SelectItem value={l.consultor_id}>{l.consultor_nome_snapshot} (inativo)</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {inativo && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
                      </div>
                      <Input
                        type="number"
                        min="0"
                        value={l.leads_recebidos || ''}
                        onChange={(e) => atualizarLinha(idx, { leads_recebidos: Number(e.target.value) || 0 })}
                        className="h-8"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.investimento_direcionado || ''}
                        onChange={(e) => atualizarLinha(idx, { investimento_direcionado: Number(e.target.value) || 0 })}
                        className="h-8"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removerLinha(idx)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[1fr_110px_140px_40px] gap-2 p-2 bg-muted/40 text-sm font-medium">
                  <div>Totais · CPL: {formatBRL(cpl)}</div>
                  <div>{totalLeads}</div>
                  <div>{formatBRL(totalCampanha)}</div>
                  <div />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar consultor
              </Button>
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
            </div>
          </div>
        </div>

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
