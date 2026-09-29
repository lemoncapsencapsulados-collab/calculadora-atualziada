import { afterEach, describe, expect, it, vi } from 'vitest';
import { aviso, fecharAviso, inscrever, lerAvisos } from './avisos';

afterEach(() => {
  aviso.dismiss();
  vi.useRealTimers();
});

describe('aviso que fica na tela', () => {
  it('erro não sai sozinho', async () => {
    // É o ponto da mudança: erro que some em quatro segundos não é visto por
    // quem está digitando -- foi assim que se perdeu um Pedido de Compra.
    vi.useFakeTimers();
    aviso.error('Erro ao salvar');
    vi.advanceTimersByTime(60_000);
    expect(lerAvisos()).toHaveLength(1);
    expect(lerAvisos()[0].tipo).toBe('erro');
  });

  it('alerta também fica', () => {
    vi.useFakeTimers();
    aviso.warning('Confira o preço');
    vi.advanceTimersByTime(60_000);
    expect(lerAvisos()).toHaveLength(1);
  });

  it('sucesso sai sozinho', () => {
    // "Salvo" é confirmação, não decisão: não precisa de clique para sumir.
    vi.useFakeTimers();
    aviso.success('Salvo');
    expect(lerAvisos()).toHaveLength(1);
    vi.advanceTimersByTime(10_000);
    expect(lerAvisos()).toHaveLength(0);
  });

  it('fecha pelo botão', () => {
    aviso.error('Erro X');
    fecharAviso(lerAvisos()[0].id);
    expect(lerAvisos()).toHaveLength(0);
  });
});

describe('o que chega das 357 chamadas antigas', () => {
  it('aceita Error no lugar de texto', () => {
    // Várias chamadas faziam toast.error(e) direto no catch.
    aviso.error(new Error('Falha de rede'));
    expect(lerAvisos()[0].titulo).toBe('Falha de rede');
  });

  it('aceita objeto com message', () => {
    aviso.error({ message: 'Erro do Supabase' });
    expect(lerAvisos()[0].titulo).toBe('Erro do Supabase');
  });

  it('leva a descrição junto', () => {
    aviso.error('Não salvou', { description: 'Tente de novo' });
    expect(lerAvisos()[0].detalhe).toBe('Tente de novo');
  });

  it('mensagem vazia não vira aviso em branco', () => {
    aviso.error('');
    aviso.error(null);
    aviso.error('   ');
    expect(lerAvisos()).toHaveLength(0);
  });

  it('info e message viram alerta', () => {
    aviso.info('Aviso');
    expect(lerAvisos()[0].tipo).toBe('alerta');
  });
});

describe('sem empilhar repetido', () => {
  it('a mesma mensagem não aparece duas vezes', () => {
    // Um loop que falha 30 vezes cobria a tela inteira de avisos iguais.
    aviso.error('Erro ao salvar');
    aviso.error('Erro ao salvar');
    aviso.error('Erro ao salvar');
    expect(lerAvisos()).toHaveLength(1);
  });

  it('mensagens diferentes convivem', () => {
    aviso.error('Erro A');
    aviso.error('Erro B');
    expect(lerAvisos()).toHaveLength(2);
  });

  it('mesmo texto com tipo diferente são avisos distintos', () => {
    aviso.error('Preço');
    aviso.success('Preço');
    expect(lerAvisos()).toHaveLength(2);
  });
});

describe('quem desenha a faixa é avisado', () => {
  it('a inscrição recebe cada mudança', () => {
    const chamadas: number[] = [];
    const cancelar = inscrever(() => chamadas.push(lerAvisos().length));
    aviso.error('Um');
    aviso.error('Dois');
    fecharAviso(lerAvisos()[0].id);
    cancelar();
    aviso.error('Depois de cancelar');
    expect(chamadas).toEqual([1, 2, 1]);
  });

  it('dismiss sem id limpa tudo', () => {
    aviso.error('A');
    aviso.warning('B');
    aviso.dismiss();
    expect(lerAvisos()).toHaveLength(0);
  });
});
