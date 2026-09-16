import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Loader2, Pencil, Trash2, Download, Upload, Mail, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useContratoModelosDocx, useCriarModeloDocx, useExcluirModeloDocx, useAtualizarModeloDocx, ContratoModeloDocx } from '@/hooks/useContratoModelosDocx';
import { PreencherContratoDialog } from '@/components/contratos-docx/PreencherContratoDialog';
import { toast } from 'sonner';

export default function EditorContratos() {
  const { data: modelos = [], isLoading } = useContratoModelosDocx();
  const criar = useCriarModeloDocx();
  const excluir = useExcluirModeloDocx();
  const atualizar = useAtualizarModeloDocx();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [emailFinanceiro, setEmailFinanceiro] = useState('');
  const [nomeFinanceiro, setNomeFinanceiro] = useState('');

  const [toDelete, setToDelete] = useState<ContratoModeloDocx | null>(null);
  const [preencher, setPreencher] = useState<ContratoModeloDocx | null>(null);
  const [editando, setEditando] = useState<ContratoModeloDocx | null>(null);
  const [editForm, setEditForm] = useState({ nome: '', descricao: '', email_financeiro: '', nome_financeiro: '' });

  const handleUpload = async () => {
    if (!file || !nome.trim()) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Envie um arquivo .docx');
      return;
    }
    await criar.mutateAsync({ nome, descricao, file, email_financeiro: emailFinanceiro, nome_financeiro: nomeFinanceiro });
    setUploadOpen(false);
    setNome(''); setDescricao(''); setFile(null); setEmailFinanceiro(''); setNomeFinanceiro('');
  };

  const abrirEdicao = (m: ContratoModeloDocx) => {
    setEditando(m);
    setEditForm({
      nome: m.nome,
      descricao: m.descricao || '',
      email_financeiro: m.email_financeiro || '',
      nome_financeiro: m.nome_financeiro || '',
    });
  };

  const salvarEdicao = async () => {
    if (!editando || !editForm.nome.trim()) return;
    await atualizar.mutateAsync({
      id: editando.id,
      patch: {
        nome: editForm.nome.trim(),
        descricao: editForm.descricao.trim() || null,
        email_financeiro: editForm.email_financeiro.trim() || null,
        nome_financeiro: editForm.nome_financeiro.trim() || null,
      },
    });
    toast.success('Modelo atualizado.');
    setEditando(null);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Editor de Contratos</h1>
            <p className="text-sm text-muted-foreground">Modelos internos em DOCX, editáveis no navegador</p>
          </div>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Enviar novo modelo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Biblioteca de modelos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando...
            </div>
          ) : modelos.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhum modelo enviado ainda. Clique em <strong>Enviar novo modelo</strong> para começar.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {modelos.map((m) => (
                <div key={m.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{m.nome}</h3>
                        <Badge variant="outline">v{m.versao}</Badge>
                        {m.html_editado ? (
                          <Badge variant="secondary">{m.variaveis_detectadas?.length || 0} variáveis</Badge>
                        ) : (
                          <Badge variant="destructive">Não editado</Badge>
                        )}
                        {m.email_financeiro ? (
                          <Badge variant="default" className="gap-1"><Mail className="w-3 h-3" /> {m.email_financeiro}</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1"><Mail className="w-3 h-3" /> sem email financeiro</Badge>
                        )}
                      </div>
                      {m.descricao && <p className="text-xs text-muted-foreground mt-1">{m.descricao}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">{m.arquivo_nome}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-3 flex-wrap">
                    <Button asChild size="sm" variant="default">
                      <Link to={`/editor-contratos/${m.id}`}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => abrirEdicao(m)}>
                      <Mail className="w-3.5 h-3.5 mr-1" /> Dados/Financeiro
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPreencher(m)} disabled={!m.html_editado}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Gerar contrato
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(m)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo modelo de contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Contrato padrão suplementos" />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Quando usar este modelo..." />
            </div>
            <div className="space-y-1">
              <Label>Arquivo DOCX <span className="text-destructive">*</span></Label>
              <Input type="file" accept=".docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && <p className="text-xs text-muted-foreground">Selecionado: {file.name}</p>}
            </div>
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1"><Mail className="w-4 h-4" /> Envio para Financeiro</Label>
                <p className="text-xs text-muted-foreground">Ao clicar em "Enviar para financeiro" no fluxo do contrato, o DOCX gerado será enviado para este email.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email do financeiro</Label>
                  <Input type="email" value={emailFinanceiro} onChange={(e) => setEmailFinanceiro(e.target.value)} placeholder="financeiro@empresa.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nome do destinatário</Label>
                  <Input value={nomeFinanceiro} onChange={(e) => setNomeFinanceiro(e.target.value)} placeholder="Setor Financeiro" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Dica: você pode marcar campos preencháveis no seu DOCX como <code>{'{{NOME_CONTRATANTE}}'}</code>, <code>{'{{CNPJ}}'}</code>, etc. — o sistema detecta e permite editar cada um antes de gerar o contrato.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={criar.isPending || !nome.trim() || !file}>
              {criar.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar dados do modelo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea rows={2} value={editForm.descricao} onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} />
            </div>
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <Label className="text-sm font-semibold flex items-center gap-1"><Mail className="w-4 h-4" /> Envio para Financeiro</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={editForm.email_financeiro} onChange={(e) => setEditForm({ ...editForm, email_financeiro: e.target.value })} placeholder="financeiro@empresa.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input value={editForm.nome_financeiro} onChange={(e) => setEditForm({ ...editForm, nome_financeiro: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={atualizar.isPending || !editForm.nome.trim()}>
              {atualizar.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PreencherContratoDialog
        open={!!preencher}
        onOpenChange={(o) => !o && setPreencher(null)}
        modelo={preencher}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{toDelete?.nome}</strong>? O arquivo original também será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (toDelete) await excluir.mutateAsync(toDelete);
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