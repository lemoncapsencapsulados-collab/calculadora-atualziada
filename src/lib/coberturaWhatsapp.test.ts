import { describe, expect, it } from 'vitest';
import {
  type Cobertura,
  DIAS_PARA_SUSPEITA,
  avisoCobertura,
  coberturaDaJanela,
  diasSemSincronizar,
  sincronizacaoParada,
} from './coberturaWhatsapp';

/** Janela de um mês inteiro em horário local, como o filtro do painel monta. */
function mes(ano: number, mesNum: number) {
  return {
    inicio: new Date(ano, mesNum - 1, 1, 0, 0, 0),
    fim: new Date(ano, mesNum, 0, 23, 59, 59),
  };
}

const ULTIMA = '2026-09-01T14:30:00-03:00';

describe('cobertura da janela', () => {
  const casos: [string, Cobertura, ReturnType<typeof mes>][] = [
    ['agosto, todo antes do fim da sincronização', 'coberta', mes(2026, 8)],
    ['outubro, todo depois', 'descoberta', mes(2026, 10)],
    ['setembro, começa no dia da última mensagem', 'parcial', mes(2026, 9)],
  ];

  for (const [nome, esperado, janela] of casos) {
    it(nome, () => {
      expect(coberturaDaJanela({ ...janela, ultimaMensagem: ULTIMA })).toBe(esperado);
    });
  }

  it('sem mensagem nenhuma, não afirma nada', () => {
    expect(coberturaDaJanela({ ...mes(2026, 8), ultimaMensagem: null })).toBe('desconhecida');
  });

  it('data inválida conta como ausente, não quebra a tela', () => {
    expect(coberturaDaJanela({ ...mes(2026, 8), ultimaMensagem: 'ontem' })).toBe('desconhecida');
  });

  it('mês fechado não vira "parcial" por causa da hora', () => {
    // A janela termina 31/08 às 23:59:59 e a última mensagem é 31/08 às 14h.
    // Comparando instantes, todo mês fechado acusaria corte -- e um aviso que
    // aparece sempre deixa de ser lido.
    expect(
      coberturaDaJanela({ ...mes(2026, 8), ultimaMensagem: '2026-08-31T14:00:00-03:00' }),
    ).toBe('coberta');
  });
});

describe('sincronização parada', () => {
  it('conta os dias desde a última mensagem', () => {
    expect(diasSemSincronizar(ULTIMA, new Date(2026, 9, 5))).toBe(34);
  });

  it('fim de semana não é defeito', () => {
    // Sexta à noite a domingo: dois dias sem mensagem é expediente fechado.
    const sexta = new Date(2026, 9, 2, 20, 0, 0);
    const domingo = new Date(2026, 9, 4, 9, 0, 0);
    expect(diasSemSincronizar(sexta, domingo)).toBeLessThan(DIAS_PARA_SUSPEITA);
    expect(sincronizacaoParada(sexta, domingo)).toBe(false);
  });

  it('34 dias é parada', () => {
    expect(sincronizacaoParada(ULTIMA, new Date(2026, 9, 5))).toBe(true);
  });

  it('data no futuro não vira dias negativos', () => {
    expect(diasSemSincronizar('2026-12-01T00:00:00-03:00', new Date(2026, 9, 5))).toBe(0);
  });

  it('sem mensagem não acusa parada: não há de quando contar', () => {
    expect(sincronizacaoParada(null, new Date(2026, 9, 5))).toBe(false);
  });
});

describe('o aviso que o painel mostra', () => {
  const hoje = new Date(2026, 9, 5);

  it('período inteiro sem dado diz a data do último dado e sugere o que fazer', () => {
    // O caso real: EVERTON pesquisado em setembro/2026 deu "1 conversa". Era
    // período sem ingestão, não consultor sem atendimento.
    const a = avisoCobertura({ ...mes(2026, 10), ultimaMensagem: ULTIMA }, hoje)!;
    expect(a.tom).toBe('parada');
    expect(a.titulo).toContain('01/09/2026');
    expect(a.detalhe).toContain('não porque o consultor deixou de atender');
    expect(a.confiavelAte.getTime()).toBe(new Date(ULTIMA).getTime());
  });

  it('período cortado no meio avisa até onde vale', () => {
    const a = avisoCobertura({ ...mes(2026, 9), ultimaMensagem: ULTIMA }, hoje)!;
    expect(a.titulo).toContain('cortado');
    expect(a.detalhe).toContain('30/09/2026');
    expect(a.detalhe).toContain('01/09/2026');
  });

  it('mês completo ainda avisa quando a ingestão está morta', () => {
    // Agosto está íntegro, mas quem olha precisa saber que o painel parou de
    // receber: senão confia nele para decidir sobre esta semana.
    const a = avisoCobertura({ ...mes(2026, 8), ultimaMensagem: ULTIMA }, hoje)!;
    expect(a.tom).toBe('parada');
    expect(a.titulo).toContain('parada desde');
  });

  it('sem nenhuma mensagem, não insinua que o consultor não trabalhou', () => {
    const a = avisoCobertura({ ...mes(2026, 8), ultimaMensagem: null }, hoje)!;
    expect(a.detalhe).toContain('não por falta de atendimento');
  });

  it('cala a boca quando está tudo em ordem', () => {
    // Único caso sem aviso: janela coberta e ingestão viva. Um aviso que
    // aparece em toda pesquisa não é lido em nenhuma.
    const ontem = new Date(2026, 9, 4, 18, 0, 0);
    expect(avisoCobertura({ ...mes(2026, 9), ultimaMensagem: ontem }, hoje)).toBeNull();
  });
});
