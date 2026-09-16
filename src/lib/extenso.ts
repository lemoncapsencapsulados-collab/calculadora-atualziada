// Conversão de número para extenso em português (BRL)
const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function ateNoventaENove(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (n < 20) return DEZ_A_DEZENOVE[n - 10];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
}

function ateNovecentosENoventaENove(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c === 0) return ateNoventaENove(resto);
  if (resto === 0) return CENTENAS[c];
  return `${CENTENAS[c]} e ${ateNoventaENove(resto)}`;
}

function grupoExtenso(n: number, singular: string, plural: string): string {
  if (n === 0) return '';
  if (n === 1) return `um ${singular}`;
  return `${ateNovecentosENoventaENove(n)} ${plural}`;
}

function inteiroExtenso(n: number): string {
  if (n === 0) return 'zero';
  const bilhoes = Math.floor(n / 1_000_000_000);
  const milhoes = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: string[] = [];
  if (bilhoes) partes.push(grupoExtenso(bilhoes, 'bilhão', 'bilhões'));
  if (milhoes) partes.push(grupoExtenso(milhoes, 'milhão', 'milhões'));
  if (milhares) {
    partes.push(milhares === 1 ? 'mil' : `${ateNovecentosENoventaENove(milhares)} mil`);
  }
  if (resto) partes.push(ateNovecentosENoventaENove(resto));

  // Junta com vírgulas; última separação com " e " quando apropriado
  if (partes.length === 1) return partes[0];
  const last = partes.pop()!;
  // Se o último grupo é < 100 ou múltiplo exato de 100, usar "e" antes
  const lastNum = resto || milhares * 1000 || milhoes * 1_000_000;
  const usaE = resto > 0 && (resto < 100 || resto % 100 === 0);
  return usaE ? `${partes.join(', ')} e ${last}` : `${partes.join(', ')}, ${last}`;
}

export function valorPorExtensoBRL(valor: number): string {
  if (valor == null || isNaN(valor)) return '';
  const sinal = valor < 0 ? 'menos ' : '';
  const abs = Math.abs(valor);
  const inteiros = Math.floor(abs);
  const centavos = Math.round((abs - inteiros) * 100);

  const parteInt = inteiros === 0 && centavos > 0 ? '' : inteiroExtenso(inteiros);
  const moeda = inteiros === 1 ? 'real' : 'reais';
  const centavoStr = centavos === 1 ? 'centavo' : 'centavos';

  if (inteiros > 0 && centavos > 0) {
    return `${sinal}${parteInt} ${moeda} e ${inteiroExtenso(centavos)} ${centavoStr}`;
  }
  if (inteiros > 0) {
    return `${sinal}${parteInt} ${moeda}`;
  }
  if (centavos > 0) {
    return `${sinal}${inteiroExtenso(centavos)} ${centavoStr}`;
  }
  return 'zero reais';
}

export function formatBRL(valor: number): string {
  return (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dataPorExtenso(data: Date = new Date()): string {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${data.getDate()} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
}