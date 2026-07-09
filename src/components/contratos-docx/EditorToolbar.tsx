import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight, Table as TableIcon, Undo, Redo, Braces } from 'lucide-react';

export function EditorToolbar({ editor, onInsertVariable }: { editor: Editor | null; onInsertVariable?: () => void }) {
  if (!editor) return null;
  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <Button type="button" size="sm" variant={active ? 'default' : 'ghost'} className="h-8 w-8 p-0" onClick={onClick} title={title}>
      {icon}
    </Button>
  );
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-2 sticky top-0 z-10">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold className="w-4 h-4" />, 'Negrito')}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic className="w-4 h-4" />, 'Itálico')}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon className="w-4 h-4" />, 'Sublinhado')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 className="w-4 h-4" />, 'Título 1')}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="w-4 h-4" />, 'Título 2')}
      {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 className="w-4 h-4" />, 'Título 3')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List className="w-4 h-4" />, 'Lista')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="w-4 h-4" />, 'Lista numerada')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(editor.isActive({ textAlign: 'left' }), () => editor.chain().focus().setTextAlign('left').run(), <AlignLeft className="w-4 h-4" />, 'Esquerda')}
      {btn(editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), <AlignCenter className="w-4 h-4" />, 'Centro')}
      {btn(editor.isActive({ textAlign: 'right' }), () => editor.chain().focus().setTextAlign('right').run(), <AlignRight className="w-4 h-4" />, 'Direita')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(false, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), <TableIcon className="w-4 h-4" />, 'Inserir tabela')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(false, () => editor.chain().focus().undo().run(), <Undo className="w-4 h-4" />, 'Desfazer')}
      {btn(false, () => editor.chain().focus().redo().run(), <Redo className="w-4 h-4" />, 'Refazer')}
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