import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUsuarios, useConsultoresUso, type Usuario, type UsuarioInsert, type ConsultorUso } from '@/hooks/useUsuarios';
import { Search, Plus, Pencil, UserCheck, UserX, Users, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function ConsultoresAdmin() {
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [filtroNome, setFiltroNome] = useState('');
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmInativar, setConfirmInativar] = useState<{ usuario: Usuario; uso: ConsultorUso } | null>(null);

  const { data: usuarios = [], criar, atualizar, toggleAtivo } = useUsuarios(!mostrarInativos);
  const { data: usoMap } = useConsultoresUso();

  const getUso = (nome: string): ConsultorUso => {
    const k = nome.trim().toLowerCase();
    return usoMap?.get(k) || { orcamentos: 0, pedidos: 0, recompras: 0, total: 0 };
  };

  const filtrados = usuarios.filter((u) =>
    u.nome.toLowerCase().includes(filtroNome.toLowerCase())
  );

  const handleSalvar = async (dados: UsuarioInsert) => {
    if (editando) {
      await atualizar.mutateAsync({ id: editando.id, ...dados });
    } else {
      await criar.mutateAsync(dados);
    }
    setFormOpen(false);
    setEditando(null);
  };

  const handleToggleAtivo = (u: Usuario) => {
    const uso = getUso(u.nome);
    if (u.ativo && uso.total > 0) {
      setConfirmInativar({ usuario: u, uso });
      return;
    }
    toggleAtivo.mutate({ id: u.id, ativo: !u.ativo });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Consultores
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cadastre consultores aqui. Eles ficam disponíveis automaticamente em orçamentos, pedidos, dashboard e demais áreas.
        </p>
      </CardHeader>
      <CardContent>
        {formOpen ? (
          <ConsultorForm
            usuario={editando}
            onSalvar={handleSalvar}
            onCancelar={() => { setFormOpen(false); setEditando(null); }}
            loading={criar.isPending || atualizar.isPending}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por nome..."
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={mostrarInativos} onCheckedChange={setMostrarInativos} id="cons-mostrar-inativos" />
                <Label htmlFor="cons-mostrar-inativos" className="text-sm whitespace-nowrap">Mostrar inativos</Label>
              </div>
              <Button size="sm" onClick={() => { setEditando(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Novo Consultor
              </Button>
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Em uso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum consultor encontrado
                      </TableCell>
                    </TableRow>
                  )}
                  {filtrados.map((u) => {
                    const uso = getUso(u.nome);
                    return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome}</TableCell>
                      <TableCell className="text-sm">{u.telefone || '-'}</TableCell>
                      <TableCell className="text-sm">{u.cargo}</TableCell>
                      <TableCell className="text-sm">{u.email || '-'}</TableCell>
                      <TableCell>
                        {uso.total === 0 ? (
                          <span className="text-xs text-muted-foreground">Nenhum vínculo</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" title="Orçamentos">Orç: {uso.orcamentos}</Badge>
                            <Badge variant="outline" title="Pedidos">Ped: {uso.pedidos}</Badge>
                            {uso.recompras > 0 && (
                              <Badge variant="outline" title="Recompras">Rec: {uso.recompras}</Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.ativo ? 'default' : 'secondary'}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditando(u); setFormOpen(true); }} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleAtivo(u)}
                            title={u.ativo ? (uso.total > 0 ? `Inativar (em uso em ${uso.total} registro(s))` : 'Inativar') : 'Ativar'}
                          >
                            {u.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmInativar} onOpenChange={(o) => !o && setConfirmInativar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Consultor em uso
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>{confirmInativar?.usuario.nome}</strong> está vinculado a registros existentes:
                </p>
                <ul className="list-disc pl-5 text-sm">
                  <li>{confirmInativar?.uso.orcamentos || 0} orçamento(s)</li>
                  <li>{confirmInativar?.uso.pedidos || 0} pedido(s)</li>
                  <li>{confirmInativar?.uso.recompras || 0} recompra(s)</li>
                </ul>
                <p className="text-sm">
                  Inativar não apaga os registros, mas o consultor deixará de aparecer como opção em novos orçamentos e pedidos. Deseja continuar?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmInativar) {
                  toggleAtivo.mutate({ id: confirmInativar.usuario.id, ativo: false });
                  setConfirmInativar(null);
                }
              }}
            >
              Inativar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ConsultorForm({
  usuario,
  onSalvar,
  onCancelar,
  loading,
}: {
  usuario: Usuario | null;
  onSalvar: (dados: UsuarioInsert) => void;
  onCancelar: () => void;
  loading: boolean;
}) {
  const [nome, setNome] = useState(usuario?.nome || '');
  const [telefone, setTelefone] = useState(usuario?.telefone || '');
  const [cargo, setCargo] = useState(usuario?.cargo || 'Consultor');
  const [email, setEmail] = useState(usuario?.email || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) return;
    onSalvar({
      nome: nome.trim(),
      telefone: telefone.trim(),
      cargo: cargo.trim() || 'Consultor',
      email: email.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-semibold">{usuario ? 'Editar Consultor' : 'Novo Consultor'}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Telefone *</Label>
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" required />
        </div>
        <div className="space-y-2">
          <Label>Cargo</Label>
          <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Consultor" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" disabled={loading || !nome.trim() || !telefone.trim()}>
          {loading ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}