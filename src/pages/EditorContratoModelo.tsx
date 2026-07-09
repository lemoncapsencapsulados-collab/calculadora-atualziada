import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { ParagraphWithStyle, HeadingWithStyle, TableCellWithStyle, TableHeaderWithStyle, TextStyleAll } from '@/lib/tiptapPreserveStyle';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import { ArrowLeft, Save, Loader2, Braces, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useContratoModeloDocx, useAtualizarModeloDocx, baixarModeloArquivo, detectarVariaveis } from '@/hooks/useContratoModelosDocx';
import { docxParaHtml } from '@/lib/docxEditor';
import { EditorToolbar } from '@/components/contratos-docx/EditorToolbar';
import { PreencherContratoDialog } from '@/components/contratos-docx/PreencherContratoDialog';
import { toast } from 'sonner';

export default function EditorContratoModelo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: modelo, isLoading } = useContratoModeloDocx(id);
  const atualizar = useAtualizarModeloDocx();

  const [carregandoDocx, setCarregandoDocx] = useState(false);
  const [erroCarregar, setErroCarregar] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [insertVarOpen, setInsertVarOpen] = useState(false);
  const [novaVariavel, setNovaVariavel] = useState('');
  const [preencherOpen, setPreencherOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false, heading: false }),
      ParagraphWithStyle,
      HeadingWithStyle,
      TextStyleAll,
      Color,
      FontFamily,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeaderWithStyle,
      TableCellWithStyle,
    ],
    content: '<p>Carregando modelo...</p>',
    editorProps: {
      attributes: {
        class: 'contrato-editor prose prose-sm max-w-none focus:outline-none min-h-[70vh] p-10 bg-white text-black shadow-inner',
      },
    },
  });

  // Carrega HTML (do salvo, ou converte o DOCX original)
  useEffect(() => {
    if (!editor || !modelo) return;
    (async () => {
      if (modelo.html_editado) {
        editor.commands.setContent(modelo.html_editado);
        return;
      }
      setCarregandoDocx(true);
      setErroCarregar('');
      try {
        const ab = await baixarModeloArquivo(modelo.arquivo_url);
        const html = await docxParaHtml(ab);
        editor.commands.setContent(html || '<p></p>');
      } catch (e: any) {
        setErroCarregar(e?.message || 'Falha ao converter DOCX');
      } finally {
        setCarregandoDocx(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, modelo?.id]);

  const variaveisAtuais = useMemo(() => {
    if (!editor) return [] as string[];
    return detectarVariaveis(editor.getHTML());
  }, [editor, editor?.state]);

  const salvar = async () => {
    if (!editor || !modelo) return;
    setSalvando(true);
    try {
      const html = editor.getHTML();
      const vars = detectarVariaveis(html);
      await atualizar.mutateAsync({
        id: modelo.id,
        patch: {
          html_editado: html,
          variaveis_detectadas: vars as any,
          versao: (modelo.versao || 1) + 1,
        },
      });
      toast.success('Modelo salvo!');
    } finally {
      setSalvando(false);
    }
  };

  const inserirVariavel = () => {
    if (!editor || !novaVariavel.trim()) return;
    const nome = novaVariavel.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    editor.chain().focus().insertContent(`{{${nome}}}`).run();
    setInsertVarOpen(false);
    setNovaVariavel('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando modelo...
      </div>
    );
  }

  if (!modelo) {
    return (
      <div className="container mx-auto px-4 py-6 text-center text-muted-foreground">
        Modelo não encontrado. <Link to="/editor-contratos" className="text-primary underline">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/editor-contratos')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5" /> {modelo.nome}
            </h1>
            <p className="text-xs text-muted-foreground">v{modelo.versao} · {modelo.arquivo_nome}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPreencherOpen(true)} disabled={!editor}>
            <Download className="w-4 h-4 mr-2" /> Gerar contrato
          </Button>
          <Button onClick={salvar} disabled={salvando || !editor}>
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <Card className="overflow-hidden">
          <EditorToolbar editor={editor} onInsertVariable={() => setInsertVarOpen(true)} />
          {carregandoDocx && (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> Convertendo DOCX para editor...
            </div>
          )}
          {erroCarregar && (
            <div className="p-4 bg-destructive/10 text-destructive text-sm">{erroCarregar}</div>
          )}
          <div className="max-h-[75vh] overflow-y-auto bg-muted/20">
            <EditorContent editor={editor} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Braces className="w-4 h-4" />
              <h3 className="font-semibold text-sm">Variáveis detectadas</h3>
              <Badge variant="secondary" className="ml-auto">{variaveisAtuais.length}</Badge>
            </div>
            {variaveisAtuais.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma variável ainda. Clique em <strong>Variável</strong> na barra de ferramentas ou digite <code>{'{{NOME}}'}</code> no texto.
              </p>
            ) : (
              <ul className="space-y-1">
                {variaveisAtuais.map((v) => (
                  <li key={v}>
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded block truncate">{`{{${v}}}`}</code>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4 text-xs text-muted-foreground space-y-2">
            <p><strong>Dicas:</strong></p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Use <code>{'{{VARIAVEL}}'}</code> em qualquer lugar do texto</li>
              <li>Ao gerar o contrato, cada variável vira um campo editável</li>
              <li>Salve para atualizar a versão do modelo</li>
            </ul>
          </Card>
        </div>
      </div>

      <Dialog open={insertVarOpen} onOpenChange={setInsertVarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inserir variável</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome da variável</Label>
            <Input
              value={novaVariavel}
              onChange={(e) => setNovaVariavel(e.target.value)}
              placeholder="Ex.: NOME_CONTRATANTE"
              onKeyDown={(e) => e.key === 'Enter' && inserirVariavel()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Será inserido no texto como <code>{`{{${(novaVariavel || 'NOME').toUpperCase().replace(/[^A-Z0-9_]/g, '_')}}}`}</code>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsertVarOpen(false)}>Cancelar</Button>
            <Button onClick={inserirVariavel} disabled={!novaVariavel.trim()}>Inserir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PreencherContratoDialog
        open={preencherOpen}
        onOpenChange={setPreencherOpen}
        modelo={editor ? { ...modelo, html_editado: editor.getHTML() } : modelo}
      />
    </div>
  );
}