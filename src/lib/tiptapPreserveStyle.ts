import { Paragraph } from '@tiptap/extension-paragraph';
import { Heading } from '@tiptap/extension-heading';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import { Mark, mergeAttributes } from '@tiptap/core';

// Preserva o atributo `style` inline em parágrafos, headings, células e spans
// para que o editor mantenha 100% da formatação do DOCX original (fonte,
// tamanho, cor, alinhamento, espaçamento etc.).

function withStyleAttr<T extends { extend: any }>(node: T) {
  return (node as any).extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        style: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute('style'),
          renderHTML: (attrs: any) => (attrs.style ? { style: attrs.style } : {}),
        },
      };
    },
  });
}

export const ParagraphWithStyle = withStyleAttr(Paragraph);
export const HeadingWithStyle = withStyleAttr(Heading);
export const TableCellWithStyle = withStyleAttr(TableCell);
export const TableHeaderWithStyle = withStyleAttr(TableHeader);

// TextStyle padrão do TipTap remove `style` inline exceto quando outras
// extensões (Color/FontFamily) o definem. Aqui aceitamos qualquer inline style.
export const TextStyleAll = TextStyle.extend({
  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('style'),
        renderHTML: (attrs: any) => (attrs.style ? { style: attrs.style } : {}),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (node: HTMLElement) => (node.getAttribute('style') ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

// Marca genérica para sublinhado quando vier de outra extensão
export const InlineStyleMark = Mark.create({ name: 'inlineStyleNoop' });