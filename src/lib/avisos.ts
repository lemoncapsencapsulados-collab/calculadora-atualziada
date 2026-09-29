/**
 * Avisos fixos, no lugar das notificações que apareciam e sumiam sozinhas.
 *
 * O problema das flutuantes não era estético: um erro de salvamento some em
 * poucos segundos e quem estava digitando não vê -- foi assim que se perdeu um
 * Pedido de Compra inteiro. Erro e alerta agora ficam na tela até alguém
 * fechar. Sucesso continua saindo sozinho, porque "salvo" é confirmação, não
 * decisão.
 *
 * A API é a mesma de antes (`aviso.success`, `aviso.error`, ...) de propósito:
 * são 357 chamadas em 69 arquivos, e trocar só a linha de import é uma mudança
 * que dá para conferir. Reescrever cada chamada seria mexer em 357 lugares para
 * obter o mesmo resultado.
 *
 * A loja vive fora do React porque metade das chamadas está em mutations e
 * funções soltas, onde não dá para usar hook.
 */

export type TipoAviso = 'erro' | 'alerta' | 'sucesso';

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  titulo: string;
  detalhe?: string;
}

/** Sucesso é confirmação: sai sozinho. Erro e alerta ficam. */
const MS_SUCESSO = 4500;

let avisos: Aviso[] = [];
let proximoId = 1;
const ouvintes = new Set<() => void>();

function emitir() {
  for (const ouvir of ouvintes) ouvir();
}

export function inscrever(ouvir: () => void): () => void {
  ouvintes.add(ouvir);
  return () => {
    ouvintes.delete(ouvir);
  };
}

export function lerAvisos(): Aviso[] {
  return avisos;
}

export function fecharAviso(id: number) {
  const antes = avisos.length;
  avisos = avisos.filter((a) => a.id !== id);
  if (avisos.length !== antes) emitir();
}

/** Texto do que vier: as chamadas antigas às vezes passam Error ou objeto. */
function texto(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.message;
  if (typeof v === 'object' && 'message' in (v as Record<string, unknown>)) {
    return String((v as { message: unknown }).message ?? '');
  }
  return String(v);
}

/** Opções que as chamadas antigas passavam ao sonner; só `description` importa. */
interface Opcoes {
  description?: unknown;
  [k: string]: unknown;
}

function publicar(tipo: TipoAviso, titulo: unknown, opcoes?: Opcoes) {
  const texto0 = texto(titulo).trim();
  if (!texto0) return;
  const detalhe = opcoes?.description ? texto(opcoes.description) : undefined;

  // Repetir a mesma mensagem empilhada não informa nada a mais.
  avisos = avisos.filter((a) => !(a.titulo === texto0 && a.tipo === tipo));
  const id = proximoId++;
  avisos = [...avisos, { id, tipo, titulo: texto0, detalhe }];
  emitir();

  // `setTimeout` puro, nao `window.setTimeout`: o modulo tambem roda fora do
  // navegador (testes, e qualquer renderizacao no servidor).
  if (tipo === 'sucesso') setTimeout(() => fecharAviso(id), MS_SUCESSO);
  return id;
}

/**
 * Mesmo formato do `toast` que era importado do sonner, para a troca ser só no
 * import. `loading` e `dismiss` existem porque algumas telas os chamavam.
 */
export const aviso = Object.assign(
  (mensagem: unknown, opcoes?: Opcoes) => publicar('alerta', mensagem, opcoes),
  {
    success: (mensagem: unknown, opcoes?: Opcoes) => publicar('sucesso', mensagem, opcoes),
    error: (mensagem: unknown, opcoes?: Opcoes) => publicar('erro', mensagem, opcoes),
    warning: (mensagem: unknown, opcoes?: Opcoes) => publicar('alerta', mensagem, opcoes),
    info: (mensagem: unknown, opcoes?: Opcoes) => publicar('alerta', mensagem, opcoes),
    message: (mensagem: unknown, opcoes?: Opcoes) => publicar('alerta', mensagem, opcoes),
    loading: (mensagem: unknown, opcoes?: Opcoes) => publicar('alerta', mensagem, opcoes),
    dismiss: (id?: number) => {
      if (typeof id === 'number') {
        fecharAviso(id);
        return;
      }
      avisos = [];
      emitir();
    },
  },
);
