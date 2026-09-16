import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight, Table as TableIcon, Undo, Redo, Braces, Image as ImageIcon } from 'lucide-react';
import { useRef } from 'react';

export function EditorToolbar({ editor, onInsertVariable }: { editor: Editor | null; onInsertVariable?: () => void }) {
  if (!editor) return null;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inserirImagemArquivo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      (editor.chain().focus() as any).setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  };
  const chain = () => (editor.chain().focus() as any);
  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <Button type="button" size="sm" variant={active ? 'default' : 'ghost'} className="h-8 w-8 p-0" onClick={onClick} title={title}>
      {icon}
    </Button>
  );
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-2 sticky top-0 z-10">
      {btn(editor.isActive('bold'), () => chain().toggleBold().run(), <Bold className="w-4 h-4" />, 'Negrito')}
      {btn(editor.isActive('italic'), () => chain().toggleItalic().run(), <Italic className="w-4 h-4" />, 'Itálico')}
      {btn(editor.isActive('underline'), () => chain().toggleUnderline().run(), <UnderlineIcon className="w-4 h-4" />, 'Sublinhado')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(editor.isActive('heading', { level: 1 }), () => chain().toggleHeading({ level: 1 }).run(), <Heading1 className="w-4 h-4" />, 'Título 1')}
      {btn(editor.isActive('heading', { level: 2 }), () => chain().toggleHeading({ level: 2 }).run(), <Heading2 className="w-4 h-4" />, 'Título 2')}
      {btn(editor.isActive('heading', { level: 3 }), () => chain().toggleHeading({ level: 3 }).run(), <Heading3 className="w-4 h-4" />, 'Título 3')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(editor.isActive('bulletList'), () => chain().toggleBulletList().run(), <List className="w-4 h-4" />, 'Lista')}
      {btn(editor.isActive('orderedList'), () => chain().toggleOrderedList().run(), <ListOrdered className="w-4 h-4" />, 'Lista numerada')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(editor.isActive({ textAlign: 'left' }), () => chain().setTextAlign('left').run(), <AlignLeft className="w-4 h-4" />, 'Esquerda')}
      {btn(editor.isActive({ textAlign: 'center' }), () => chain().setTextAlign('center').run(), <AlignCenter className="w-4 h-4" />, 'Centro')}
      {btn(editor.isActive({ textAlign: 'right' }), () => chain().setTextAlign('right').run(), <AlignRight className="w-4 h-4" />, 'Direita')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(false, () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), <TableIcon className="w-4 h-4" />, 'Inserir tabela')}
      {btn(false, () => fileRef.current?.click(), <ImageIcon className="w-4 h-4" />, 'Inserir imagem (ou cole com Ctrl+V)')}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) inserirImagemArquivo(f);
          e.target.value = '';
        }}
      />
      <div className="w-px h-6 bg-border mx-1" />
      {btn(false, () => chain().undo().run(), <Undo className="w-4 h-4" />, 'Desfazer')}
      {btn(false, () => chain().redo().run(), <Redo className="w-4 h-4" />, 'Refazer')}
      {onInsertVariable && (
        <>
          <div className="w-px h-6 bg-border mx-1" />
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={onInsertVariable} title="Inserir variável">
            <Braces className="w-4 h-4" /> Variável
          </Button>
        </>
      )}
    </div>
  );
}