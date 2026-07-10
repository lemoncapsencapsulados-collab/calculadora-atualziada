import { useState } from 'react';
import { FileSignature, Plus, Pencil, Trash2, Star, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useContratoModelos, useSalvarContratoModelo, useExcluirContratoModelo, ContratoModelo } from '@/hooks/useContratoModelos';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ClickUpRotuloConfigCard } from '@/components/admin/ClickUpRotuloConfigCard';

const EMPTY = { nome: '', template_id: '', ambiente: 'producao' as 'producao' | 'sandbox', descricao: '', is_padrao: false, email_envio: '', nome_envio: '' };

function VerificarTemplateButton({ templateId, ambiente }: { templateId: string; ambiente: 'producao' | 'sandbox' }) {
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    if (!templateId.trim()) return;
    setChecking(true);
    try {
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/criar-contrato-zapsign`);
      url.searchParams.set('template_id', templateId.trim());
      url.searchParams.set('ambiente', ambiente);

      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        toast.error(`Erro ao verificar: ${data?.error || resp.statusText}`);
        return;
      }

      if (data?.valid) {
        toast.success('Template validado com sucesso na ZapSign!', {
          description: `ID: ${templateId} | Ambiente: ${ambiente}`,
        });
      } else {
        toast.error(`Template não encontrado na ZapSign (${data?.status || '?'})`, {
          description: data?.hint || data?.details?.detail || 'Verifique o ID e o ambiente.',
          duration: 8000,
        });
      }
    } catch (err: any) {
      toast.error(`Falha na verificação: ${err?.message || 'erro desconhecido'}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      title="Verificar template na ZapSign"
      onClick={handleCheck}
      disabled={checking}
    >
      {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
    </Button>
  );
}


export default function ConfiguracaoContratos() {
  const { data: modelos = [], isLoading } = useContratoModelos();
  const salvar = useSalvarContratoModelo();
  const excluir = useExcluirContratoModelo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContratoModelo | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [toDelete, setToDelete] = useState<ContratoModelo | null>(null);

  const abrirNovo = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setDialogOpen(true);
  };

  const abrirEdicao = (m: ContratoModelo) => {
    setEditing(m);
    setForm({
      nome: m.nome,
      template_id: m.template_id,
      ambiente: m.ambiente,
      descricao: m.descricao || '',
      is_padrao: m.is_padrao,
      email_envio: m.email_envio || '',
      nome_envio: m.nome_envio || '',
    });
    setDialogOpen(true);
  };

  const handleSalvar = async () => {
    if (!form.nome.trim() || !form.template_id.trim()) return;
    await salvar.mutateAsync({
      id: editing?.id,
      values: {
        nome: form.nome.trim(),
        template_id: form.template_id.trim(),
        ambiente: form.ambiente,
        descricao: form.descricao.trim() || null,
        is_padrao: form.is_padrao,
        email_envio: form.email_envio.trim() || null,
        nome_envio: form.nome_envio.trim() || null,
      },
    });
    setDialogOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <FileSignature className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Configuração de Envio de Contratos</h1>
            <p className="text-sm text-muted-foreground">Modelos da ZapSign usados ao enviar contratos</p>
          </div>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="w-4 h-4 mr-2" /> Novo modelo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modelos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando...
            </div>
          ) : modelos.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhum modelo cadastrado ainda. Clique em <strong>Novo modelo</strong> para começar.
            </div>
          ) : (
            <div className="space-y-2">
              {modelos.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{m.nome}</span>
                      {m.is_padrao && <Badge variant="default" className="gap-1"><Star className="w-3 h-3" /> Padrão</Badge>}
                      <Badge variant={m.ambiente === 'producao' ? 'secondary' : 'outline'}>
                        {m.ambiente === 'producao' ? 'Produção' : 'Sandbox'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{m.template_id}</p>
                    {m.descricao && <p className="text-xs text-muted-foreground mt-1">{m.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <VerificarTemplateButton templateId={m.template_id} ambiente={m.ambiente} />
                    <Button variant="ghost" size="icon" onClick={() => abrirEdicao(m)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(m)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <ClickUpRotuloConfigCard />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar modelo' : 'Novo modelo de contrato'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Contrato padrão suplementos" />
            </div>
            <div className="space-y-1">
              <Label>Template ID (ZapSign) <span className="text-destructive">*</span></Label>
              <Input value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })} placeholder="Ex.: f933a11d-c1e3-4534-..." className="font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label>Ambiente <span className="text-destructive">*</span></Label>
              <Select value={form.ambiente} onValueChange={(v: 'producao' | 'sandbox') => setForm({ ...form, ambiente: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="producao">Produção (validade jurídica)</SelectItem>
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Descrição / observações</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Para que serve esse modelo, quando usar..." rows={3} />
            </div>
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div>
                <Label className="text-sm font-semibold">Cópia automática para email</Label>
                <p className="text-xs text-muted-foreground">Quando enviar o contrato para a ZapSign, esse email será incluído como signatário adicional e receberá o documento (Word/PDF) automaticamente.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={form.email_envio} onChange={(e) => setForm({ ...form, email_envio: e.target.value })} placeholder="contratos@empresa.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nome do destinatário</Label>
                  <Input value={form.nome_envio} onChange={(e) => setForm({ ...form, nome_envio: e.target.value })} placeholder="Ex.: Setor de Contratos" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <Label className="cursor-pointer">Marcar como padrão</Label>
                <p className="text-xs text-muted-foreground">Pré-selecionado ao enviar para a ZapSign</p>
              </div>
              <Switch checked={form.is_padrao} onCheckedChange={(c) => setForm({ ...form, is_padrao: c })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvar.isPending || !form.nome.trim() || !form.template_id.trim()}>
              {salvar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{toDelete?.nome}</strong>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (toDelete) await excluir.mutateAsync(toDelete.id);
                setToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}