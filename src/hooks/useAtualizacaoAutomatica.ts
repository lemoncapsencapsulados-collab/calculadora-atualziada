import { useEffect, useRef } from 'react';

/**
 * Recarrega a pagina quando uma versao nova e' publicada.
 *
 * O `index.html` nunca fica em cache (nginx.conf), e os arquivos de codigo levam
 * hash no nome. Entao basta reler o index e comparar o hash do bundle atual: se
 * mudou, houve deploy. Isso evita o cenario em que um computador fica dias com a
 * tela aberta rodando codigo antigo enquanto os outros ja' estao no novo.
 *
 * Nao ha' invalidacao de cache a fazer: nome novo e' arquivo novo para o
 * navegador. O que o recarregamento resolve e' o codigo ja' carregado na aba.
 */

/** Extrai o bundle principal do HTML do index. */
function bundleDoHtml(html: string): string | null {
  const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  return m ? m[1] : null;
}

/** O bundle que ESTA aba carregou, lido das tags de script da pagina. */
function bundleAtual(): string | null {
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  for (const s of scripts) {
    const src = s.getAttribute('src') || '';
    if (/\/assets\/index-.*\.js$/.test(src)) return src;
  }
  return null;
}

interface Opcoes {
  /** Intervalo entre checagens, em ms. */
  intervalo?: number;
  /** Aviso antes de recarregar; sem isso, recarrega direto. */
  aoDetectar?: (recarregar: () => void) => void;
}

export function useAtualizacaoAutomatica({ intervalo = 120_000, aoDetectar }: Opcoes = {}) {
  const inicial = useRef<string | null>(null);
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    inicial.current = bundleAtual();
    // Em desenvolvimento o bundle nao tem hash; checar seria ruido.
    if (!inicial.current) return;

    let vivo = true;

    const checar = async () => {
      if (!vivo || jaAvisou.current || document.hidden) return;
      try {
        const resp = await fetch(`/index.html?_=${Date.now()}`, { cache: 'no-store' });
        if (!resp.ok) return;
        const novo = bundleDoHtml(await resp.text());
        if (!novo || novo === inicial.current) return;

        jaAvisou.current = true;
        const recarregar = () => window.location.reload();
        if (aoDetectar) aoDetectar(recarregar);
        else recarregar();
      } catch {
        // Sem rede ou servidor fora: tenta de novo no proximo ciclo.
      }
    };

    const timer = window.setInterval(checar, intervalo);
    // Voltar para a aba e' quando a versao velha mais incomoda.
    window.addEventListener('focus', checar);
    document.addEventListener('visibilitychange', checar);

    return () => {
      vivo = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', checar);
      document.removeEventListener('visibilitychange', checar);
    };
  }, [intervalo, aoDetectar]);
}
