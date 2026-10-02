import { describe, expect, it } from 'vitest';
import { normalizarLogin } from './loginUsuario';

describe('usuário ou e-mail no login', () => {
  it('completa o domínio quando se digita só o usuário', () => {
    // O acesso foi combinado como "Admlemon", não como endereço completo.
    expect(normalizarLogin('Admlemon')).toBe('admlemon@lemoncaps.com.br');
  });

  it('não mexe em quem digita o e-mail inteiro', () => {
    expect(normalizarLogin('joaoferrari@gmail.com')).toBe('joaoferrari@gmail.com');
    expect(normalizarLogin('comercial@lemoncaps.com.br')).toBe('comercial@lemoncaps.com.br');
  });

  it('ignora maiúscula e espaço em volta', () => {
    expect(normalizarLogin('  ADMLEMON  ')).toBe('admlemon@lemoncaps.com.br');
    expect(normalizarLogin(' Joao@Gmail.com ')).toBe('joao@gmail.com');
  });

  it('não inventa e-mail a partir de texto com espaço no meio', () => {
    // "João Silva" não é usuário; melhor falhar como credencial inválida do que
    // tentar entrar num endereço que não existe.
    expect(normalizarLogin('João Silva')).not.toContain('@');
  });

  it('campo vazio continua vazio', () => {
    expect(normalizarLogin('')).toBe('');
    expect(normalizarLogin('   ')).toBe('');
  });
});
