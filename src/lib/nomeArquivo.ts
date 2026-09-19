/**
 * Nome dos documentos baixados.
 *
 * Padrao: [Cliente]_[Documento]_[Data]_[Hora]. A data e a hora sao as do
 * download, nao as do documento -- e' o que permite distinguir duas versoes
 * baixadas no mesmo dia, que era o motivo de existir o carimbo.
 */

/** Tira acento, troca separador por hifen e remove o que o sistema de arquivos recusa. */
function higienizar(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/**
 * Monta o nome do arquivo com o carimbo do momento do download.
 * `quando` existe para os testes; no uso real e' a hora atual.
 */
export function nomeArquivoDocumento(
  nomeCliente: string,
  documento: string,
  quando: Date = new Date(),
): string {
  const data = [
    doisDigitos(quando.getDate()),
    doisDigitos(quando.getMonth() + 1),
    quando.getFullYear(),
  ].join('-');
  const hora = [doisDigitos(quando.getHours()), doisDigitos(quando.getMinutes())].join('h');

  const cliente = higienizar(nomeCliente) || 'Cliente';
  return `${cliente}_${higienizar(documento)}_${data}_${hora}.pdf`;
}
