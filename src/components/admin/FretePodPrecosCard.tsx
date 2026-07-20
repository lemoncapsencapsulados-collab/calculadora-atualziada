import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, History } from 'lucide-react';
import { useFretePodPrecos, useFretePodPrecosHistorico, useUpsertPodPreco, useDesativarPodPreco } from '@/hooks/useFretePodPrecos';
import { FRETE_TIPOS_PRODUTO, FRETE_POD_PLANOS, FretePodPreco } from '@/types/frete';
import { formatBRL } from '@/lib/freteHelpers';

export function FretePodPrecosCard() {
  const { data: precos = [], isLoading } = useFretePodPrecos();
  const { data: historico = [] } = useFretePodPrecosHistorico();
  const upsertMut = useUpsertPodPreco();
  const desativarMut = useDesativarPodPreco();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FretePodPreco | null>(null);

  const grupos = useMemo(() => {
    const g: Record<string, FretePodPreco[]> = {};
    for (const p of precos) {
      (g[p.tipo_produto] ||= []).push(p);
    }
    return g;
  }, [precos]);

  const abrirNovo = () => { setEditing(null); setDialogOpen(true); };
  const abrirEditar = (p: FretePodPreco) => { setEditing(p); setDialogOpen(true); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tabela de Preços POD</CardTitle>
          <CardDescription>Preços internos de logística por tipo de produto × plano (nº de frascos)</CardDescription>
        </div>
        <Button onClick={abrirNovo}><Plus className="w-4 h-4 mr-2" />Novo Preço</Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tabela">
          <TabsList>
            <TabsTrigger value="tabela">Tabela</TabsTrigger>
            <TabsTrigger value="historico"><History className="w-4 h-4 mr-2" />Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="tabela" className="mt-4 space-y-6">
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : Object.keys(grupos).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum preço cadastrado.</p>
            ) : (
              FRETE_TIPOS_PRODUTO.filter(t => grupos[t]).map(tp => (
                <div key={tp}>
                  <h4 className="font-semibold mb-2">{tp}</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">Plano</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                          <TableHead>Faixa Peso</TableHead>
                          <TableHead>Vigência</TableHead>
                          <TableHead className="w-32">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grupos[tp].map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="text-right">{p.plano}</TableCell>
                            <TableCell className="text-right font-medium">{formatBRL(p.preco)}</TableCell>
                            <TableCell>{p.faixa_peso || '—'}</TableCell>
                            <TableCell>{new Date(p.vigencia_inicio).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => abrirEditar(p)}><Pencil className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => desativarMut.mutate(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))
            )}
            {FRETE_TIPOS_PRODUTO.filter(t => !grupos[t]).length > 0 && (
              <div className="text-xs text-muted-foreground border rounded p-3 bg-muted/30">
                Sem preços cadastrados para: <strong>{FRETE_TIPOS_PRODUTO.filter(t => !grupos[t]).join(', ')}</strong>. Use "Novo Preço" para cadastrar.
              </div>
            )}
          </TabsContent>
          <TabsContent value="historico" className="mt-4">
            {historico.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma alteração registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Plano</TableHead>
                      <TableHead className="text-right">Anterior</TableHead>
                      <TableHead className="text-right">Novo</TableHead>
                      <TableHead>Alterado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map(h => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs">{new Date(h.alterado_em).toLocaleString('pt-BR')}</TableCell>
                        <TableCell>{h.tipo_produto}</TableCell>
                        <TableCell className="text-right">{h.plano}</TableCell>
                        <TableCell className="text-right">{h.preco_anterior != null ? formatBRL(h.preco_anterior) : '—'}</TableCell>
                        <TableCell className="text-right font-medium">{formatBRL(h.preco_novo)}</TableCell>
                        <TableCell className="text-xs">{h.alterado_por_email || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {dialogOpen && (
        <PrecoDialog
          open={dialogOpen}
          editing={editing}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          onSave={async (payload) => {
            await upsertMut.mutateAsync(payload);
            setDialogOpen(false);
            setEditing(null);
          }}
          saving={upsertMut.isPending}
        />
      )}
    </Card>
  );
}

function PrecoDialog({ open, editing, onClose, onSave, saving }: {
  open: boolean;
  editing: FretePodPreco | null;
  onClose: () => void;
  onSave: (payload: { id?: string; tipo_produto: string; plano: number; preco: number; faixa_peso?: string | null; vigencia_inicio?: string }) => Promise<void>;
  saving: boolean;
}) {
  const [tipo, setTipo] = useState(editing?.tipo_produto || '');
  const [plano, setPlano] = useState(editing ? String(editing.plano) : '');
  const [preco, setPreco] = useState(editing ? String(editing.preco) : '');
  const [faixa, setFaixa] = useState(editing?.faixa_peso || '');
  const [vigencia, setVigencia] = useState(editing?.vigencia_inicio || new Date().toISOString().slice(0, 10));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Preço POD' : 'Novo Preço POD'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo de Produto *</Label>
            <Select value={tipo} onValueChange={setTipo} disabled={!!editing}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {FRETE_TIPOS_PRODUTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Plano (nº de frascos) *</Label>
            <Select value={plano} onValueChange={setPlano} disabled={!!editing}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {FRETE_POD_PLANOS.map(p => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Preço (R$) *</Label>
            <Input type="number" step="0.01" min="0" value={preco} onChange={(e) => setPreco(e.target.value)} />
          </div>
          <div>
            <Label>Faixa de peso (opcional)</Label>
            <Input value={faixa} onChange={(e) => setFaixa(e.target.value)} placeholder="ex: 301-500g" />
          </div>
          <div>
            <Label>Vigência início</Label>
            <Input type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={saving || !tipo || !plano || !preco}
            onClick={() => onSave({ id: editing?.id, tipo_produto: tipo, plano: Number(plano), preco: Number(preco), faixa_peso: faixa || null, vigencia_inicio: vigencia })}
          >Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}