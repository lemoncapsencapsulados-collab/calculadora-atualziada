import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Handshake, Plus, Pencil, UserCheck, UserX, Search } from 'lucide-react';
import { useIntermediadores, type Intermediador, type IntermediadorInput } from '@/hooks/useIntermediadores';
import { formatTelefone, isTelefoneValido, buildWhatsappUrl } from '@/lib/whatsapp';

export function IntermediadoresAdmin() {
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Intermediador | null>(null);

  const { data: lista = [], criar, atualizar, toggleAtivo } = useIntermediadores(!mostrarInativos);

  const filtrados = lista.filter((i) =>
    i.nome.toLowerCase().includes(filtro.toLowerCase()) ||
    (i.whatsapp || '').includes(filtro)
  );

  const handleSalvar = async (dados: IntermediadorInput) => {
    if (editando) await atualizar.mutateAsync({ id: editando.id, ...dados });
    else await criar.mutateAsync(dados);
    setFormOpen(false);
    setEditando(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Handshake className="w-5 h-5" />
          Intermediadores
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cadastre os intermediadores que recebem comissão. Eles ficam disponíveis na etapa de confirmação do orçamento.
        </p>
      </CardHeader>
      <CardContent>
        {formOpen ? (
          <IntermediadorForm
            intermediador={editando}
            loading={criar.isPending || atualizar.isPending}
            onSalvar={handleSalvar}
            onCancelar={() => { setFormOpen(false); setEditando(null); }}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar por nome ou WhatsApp"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="inativos-interm" checked={mostrarInativos} onCheckedChange={setMostrarInativos} />
                <Label htmlFor="inativos-interm" className="text-sm">Mostrar inativos</Label>
              </div>
              <Button onClick={() => { setEditando(null); setFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Novo intermediador
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      Nenhum intermediador cadastrado.
                    </TableCell>
                  </TableRow>
                )}
                {filtrados.map((i) => (
                  <TableRow key={i.id} className={i.ativo ? '' : 'opacity-60'}>
                    <TableCell className="font-medium">{i.nome}</TableCell>
                    <TableCell>
                      {i.whatsapp ? (
                        <a
                          className="text-primary hover:underline"
                          href={buildWhatsappUrl(i.whatsapp, '') || '#'}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {formatTelefone(i.whatsapp)}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                      {i.observacoes || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={i.ativo ? 'secondary' : 'outline'}>{i.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditando(i); setFormOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleAtivo.mutate({ id: i.id, ativo: !i.ativo })}
                      >
                        {i.ativo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntermediadorForm({
  intermediador,
  loading,
  onSalvar,
  onCancelar,
}: {
  intermediador: Intermediador | null;
  loading: boolean;
  onSalvar: (dados: IntermediadorInput) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(intermediador?.nome || '');
  const [whatsapp, setWhatsapp] = useState(intermediador?.whatsapp || '');
  const [observacoes, setObservacoes] = useState(intermediador?.observacoes || '');

  const telefoneInvalido = whatsapp.trim() !== '' && !isTelefoneValido(whatsapp);
  const podeSalvar = nome.trim().length > 1 && !telefoneInvalido;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="space-y-1.5">
          <Label>WhatsApp</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" />
          {telefoneInvalido && <p className="text-xs text-destructive">Telefone inválido — informe DDD + número.</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button disabled={!podeSalvar || loading} onClick={() => onSalvar({ nome, whatsapp, observacoes })}>
          {intermediador ? 'Salvar alterações' : 'Cadastrar'}
        </Button>
      </div>
    </div>
  );
}
