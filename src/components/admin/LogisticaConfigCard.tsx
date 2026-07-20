import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Truck } from 'lucide-react';
import { useFretePodPrecos, useUpsertPodPreco, useDesativarPodPreco } from '@/hooks/useFretePodPrecos';
import { useFreteMargemFaixas, useUpsertMargemFaixa, useDeleteMargemFaixa } from '@/hooks/useFreteMargemFaixas';
import { FRETE_TIPOS_PRODUTO, FRETE_POD_PLANOS_SUGERIDOS, FretePodPreco } from '@/types/frete';
import { formatBRL } from '@/lib/freteHelpers';
import { FreteMargemFaixa } from '@/types/frete';

export function LogisticaConfigCard() {
  const { data: precos = [], isLoading } = useFretePodPrecos();
  const upsertPreco = useUpsertPodPreco();
  const desativarPreco = useDesativarPodPreco();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FretePodPreco | null>(null);
  const [tipoNovo, setTipoNovo] = useState<string>('');

  const precosByTipo = useMemo(() => {
    const g: Record<string, FretePodPreco[]> = {};
    for (const t of FRETE_TIPOS_PRODUTO) g[t] = [];
    for (const p of precos) (g[p.tipo_produto] ||= []).push(p);
    for (const t of Object.keys(g)) g[t].sort((a, b) => a.plano - b.plano);
    return g;
  }, [precos]);

  const abrirNovo = (tipo: string) => { setEditing(null); setTipoNovo(tipo); setDialogOpen(true); };
  const abrirEditar = (p: FretePodPreco) => { setEditing(p); setTipoNovo(p.tipo_produto); setDialogOpen(true); };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Truck className="w-5 h-5 text-primary" />Logística</CardTitle>
        <CardDescription>Frete médio e taxa de manuseio por plano, para cada tipo de produto</CardDescription>
      </CardHeader>
      <CardContent>
        <MargemFaixasEditor />
        <div className="h-4" />
        <Tabs defaultValue={FRETE_TIPOS_PRODUTO[0]}>
          <TabsList>
            {FRETE_TIPOS_PRODUTO.map(t => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}
          </TabsList>
          {FRETE_TIPOS_PRODUTO.map(tipo => (
            <TabsContent key={tipo} value={tipo} className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Planos cadastrados</h4>
                <Button size="sm" onClick={() => abrirNovo(tipo)}><Plus className="w-4 h-4 mr-2" />Novo Plano</Button>
              </div>

              {isLoading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : precosByTipo[tipo].length === 0 ? (
                <p className="text-muted-foreground text-sm border rounded p-3 bg-muted/30">Nenhum plano cadastrado. Clique em "Novo Plano".</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">Plano (frascos)</TableHead>
                        <TableHead className="text-right">Frete Médio</TableHead>
                        <TableHead className="text-right">Taxa Manuseio</TableHead>
                        <TableHead className="text-right">Total/Envio</TableHead>
                        <TableHead className="w-32">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {precosByTipo[tipo].map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-right">{p.plano}</TableCell>
                          <TableCell className="text-right font-medium">{formatBRL(p.preco)}</TableCell>
                          <TableCell className="text-right">{formatBRL(p.taxa_manuseio)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatBRL(Number(p.preco) + Number(p.taxa_manuseio || 0))}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => abrirEditar(p)}><Pencil className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => desativarPreco.mutate(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      {dialogOpen && (
        <PlanoDialog
          open={dialogOpen}
          editing={editing}
          tipoInicial={tipoNovo}
          planosExistentes={precosByTipo[tipoNovo]?.map(p => p.plano) || []}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          onSave={async (payload) => {
            await upsertPreco.mutateAsync(payload);
            setDialogOpen(false); setEditing(null);
          }}
          saving={upsertPreco.isPending}
        />
      )}
    </Card>
  );
}

function MargemFaixasEditor() {
  const { data: faixas = [], isLoading } = useFreteMargemFaixas();
  const upsert = useUpsertMargemFaixa();
  const remove = useDeleteMargemFaixa();
  const [editing, setEditing] = useState<FreteMargemFaixa | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const abrirNovo = () => { setEditing(null); setDialogOpen(true); };
  const abrirEditar = (f: FreteMargemFaixa) => { setEditing(f); setDialogOpen(true); };

  return (
    <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm">Margem de lucro por volume mensal (POD)</h4>
          <p className="text-xs text-muted-foreground">Determina a margem padrão aplicada em cada cotação de frete conforme a estimativa de envios/mês do orçamento.</p>
        </div>
        <Button size="sm" onClick={abrirNovo}><Plus className="w-4 h-4 mr-2" />Nova Faixa</Button>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Envios/mês (mín)</TableHead>
                <TableHead className="text-right">Envios/mês (máx)</TableHead>
                <TableHead className="text-right">Margem (%)</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faixas.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="text-right">{f.envios_min}</TableCell>
                  <TableCell className="text-right">{f.envios_max ?? '∞'}</TableCell>
                  <TableCell className="text-right font-semibold">{Number(f.margem_percentual)}%</TableCell>
                  <TableCell>{f.ativo ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => abrirEditar(f)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove.mutate(f.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dialogOpen && (
        <MargemFaixaDialog
          open={dialogOpen}
          editing={editing}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          onSave={async (payload) => { await upsert.mutateAsync(payload); setDialogOpen(false); setEditing(null); }}
          saving={upsert.isPending}
        />
      )}
    </div>
  );
}

function MargemFaixaDialog({ open, editing, onClose, onSave, saving }: {
  open: boolean;
  editing: FreteMargemFaixa | null;
  onClose: () => void;
  onSave: (p: { id?: string; envios_min: number; envios_max: number | null; margem_percentual: number; ativo: boolean }) => Promise<void>;
  saving: boolean;
}) {
  const [min, setMin] = useState(editing ? String(editing.envios_min) : '');
  const [max, setMax] = useState(editing?.envios_max != null ? String(editing.envios_max) : '');
  const [margem, setMargem] = useState(editing ? String(editing.margem_percentual) : '');
  const [ativo, setAtivo] = useState<boolean>(editing?.ativo ?? true);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Faixa' : 'Nova Faixa de Margem'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Envios/mês (mínimo) *</Label>
              <Input type="number" min="0" step="1" value={min} onChange={(e) => setMin(e.target.value)} />
            </div>
            <div>
              <Label>Envios/mês (máximo)</Label>
              <Input type="number" min="0" step="1" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Vazio = ∞" />
            </div>
          </div>
          <div>
            <Label>Margem de lucro (%) *</Label>
            <Input type="number" min="0" step="0.01" value={margem} onChange={(e) => setMargem(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Faixa ativa
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving || min === '' || margem === ''} onClick={() => onSave({
            id: editing?.id,
            envios_min: Number(min),
            envios_max: max === '' ? null : Number(max),
            margem_percentual: Number(margem),
            ativo,
          })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanoDialog({ open, editing, tipoInicial, planosExistentes, onClose, onSave, saving }: {
  open: boolean;
  editing: FretePodPreco | null;
  tipoInicial: string;
  planosExistentes: number[];
  onClose: () => void;
  onSave: (payload: { id?: string; tipo_produto: string; plano: number; preco: number; taxa_manuseio: number; vigencia_inicio?: string }) => Promise<void>;
  saving: boolean;
}) {
  const [plano, setPlano] = useState(editing ? String(editing.plano) : '');
  const [preco, setPreco] = useState(editing ? String(editing.preco) : '');
  const [taxa, setTaxa] = useState(editing ? String(editing.taxa_manuseio ?? 0) : '0');
  const sugestoes = FRETE_POD_PLANOS_SUGERIDOS.filter(s => !planosExistentes.includes(s) || (editing && editing.plano === s));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Editar Plano — ${tipoInicial}` : `Novo Plano — ${tipoInicial}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Plano (nº de frascos) *</Label>
            <Input type="number" min="1" step="1" value={plano} onChange={(e) => setPlano(e.target.value)} disabled={!!editing} />
            {!editing && sugestoes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {sugestoes.map(s => (
                  <button key={s} type="button" onClick={() => setPlano(String(s))} className="text-xs border rounded px-2 py-0.5 hover:bg-muted">{s}</button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Frete médio (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={preco} onChange={(e) => setPreco(e.target.value)} />
            </div>
            <div>
              <Label>Taxa de manuseio (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Total por envio = frete médio + taxa de manuseio: <strong>{formatBRL((Number(preco) || 0) + (Number(taxa) || 0))}</strong></p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving || !plano || !preco || taxa === ''} onClick={() => onSave({ id: editing?.id, tipo_produto: tipoInicial, plano: Number(plano), preco: Number(preco), taxa_manuseio: Number(taxa) || 0 })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}