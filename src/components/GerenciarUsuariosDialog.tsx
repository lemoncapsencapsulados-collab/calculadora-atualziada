import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUsuarios, type UsuarioInsert, type Usuario } from '@/hooks/useUsuarios';
import { Search, Plus, Pencil, UserCheck, UserX } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUsuarioCriado?: (nome: string) => void;
}

export default function GerenciarUsuariosDialog({ open, onOpenChange, onUsuarioCriado }: Props) {
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [filtroNome, setFiltroNome] = useState('');
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: usuarios = [], criar, atualizar, toggleAtivo } = useUsuarios(!mostrarInativos);

  const filtrados = usuarios.filter((u) =>
    u.nome.toLowerCase().includes(filtroNome.toLowerCase())
  );

  const handleNovoUsuario = () => {
    setEditando(null);
    setFormOpen(true);
  };

  const handleEditar = (u: Usuario) => {
    setEditando(u);
    setFormOpen(true);
  };

  const handleSalvar = async (dados: UsuarioInsert) => {
    if (editando) {
      await atualizar.mutateAsync({ id: editando.id, ...dados });
    } else {
      const novo = await criar.mutateAsync(dados);
      if (onUsuarioCriado && novo) {
        onUsuarioCriado(novo.nome);
      }
    }
    setFormOpen(false);
    setEditando(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerenciar Usuários</DialogTitle>
        </DialogHeader>

        {formOpen ? (
          <UsuarioForm
            usuario={editando}
            onSalvar={handleSalvar}
            onCancelar={() => { setFormOpen(false); setEditando(null); }}
            loading={criar.isPending || atualizar.isPending}
          />
        ) : (
          <div className="space-y-4 overflow-hidden flex flex-col">
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
                <Switch checked={mostrarInativos} onCheckedChange={setMostrarInativos} id="mostrar-inativos" />
                <Label htmlFor="mostrar-inativos" className="text-sm whitespace-nowrap">Mostrar inativos</Label>
              </div>
              <Button size="sm" onClick={handleNovoUsuario}>
                <Plus className="h-4 w-4 mr-1" /> Novo Usuário
              </Button>
            </div>

            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  )}
                  {filtrados.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome}</TableCell>
                      <TableCell>{u.cargo}</TableCell>
                      <TableCell className="text-sm">{u.email || '-'}</TableCell>
                      <TableCell className="text-sm">{u.telefone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={u.ativo ? 'default' : 'secondary'}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditar(u)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleAtivo.mutate({ id: u.id, ativo: !u.ativo })}
                            title={u.ativo ? 'Inativar' : 'Ativar'}
                          >
                            {u.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UsuarioForm({
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
  const [cargo, setCargo] = useState(usuario?.cargo || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [telefone, setTelefone] = useState(usuario?.telefone || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !cargo.trim()) return;
    onSalvar({ nome: nome.trim(), cargo: cargo.trim(), email: email.trim() || undefined, telefone: telefone.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-semibold">{usuario ? 'Editar Usuário' : 'Novo Usuário'}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Cargo *</Label>
          <Input value={cargo} onChange={(e) => setCargo(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" disabled={loading || !nome.trim() || !cargo.trim()}>
          {loading ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
