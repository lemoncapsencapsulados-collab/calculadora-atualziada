import { describe, it, expect } from 'vitest';
import { telefoneDe, normalizar } from './zapNormalizar.ts';

// O telefone de um contato @lid vem em `key.remoteJidAlt`. Descoberto olhando o
// payload real: 2.259 contatos estavam com telefone nulo porque a normalização
// só extraía número de `remoteJid`, e no formato @lid ele não está lá.
describe('telefoneDe', () => {
  it('extrai o telefone do remoteJidAlt num contato @lid', () => {
    expect(
      telefoneDe({
        key: {
          remoteJid: '174126580912330@lid',
          remoteJidAlt: '553171210720@s.whatsapp.net',
          addressingMode: 'lid',
        },
      } as never)
    ).toBe('553171210720');
  });

  it('extrai do proprio remoteJid quando ele ja e o formato antigo', () => {
    expect(telefoneDe({ key: { remoteJid: '5514997068645@s.whatsapp.net' } } as never)).toBe(
      '5514997068645'
    );
  });

  // Sem o alt, um @lid não tem telefone. Devolver o número do lid encheria a
  // coluna de identificadores internos disfarçados de telefone — pior que nulo,
  // porque quebraria qualquer casamento futuro com `clientes.telefone`.
  it('devolve null num @lid sem remoteJidAlt', () => {
    expect(telefoneDe({ key: { remoteJid: '174126580912330@lid' } } as never)).toBeNull();
  });

  it('devolve null em grupo', () => {
    expect(telefoneDe({ key: { remoteJid: '120363423144048387@g.us' } } as never)).toBeNull();
  });

  it('recusa o que nao parece telefone', () => {
    expect(telefoneDe({ key: { remoteJid: '0@s.whatsapp.net' } } as never)).toBeNull();
    expect(telefoneDe({ key: { remoteJid: 'abc@s.whatsapp.net' } } as never)).toBeNull();
  });

  it('nao quebra sem key', () => {
    expect(telefoneDe({} as never)).toBeNull();
  });
});

describe('normalizar', () => {
  const base = {
    key: {
      id: 'M1',
      fromMe: false,
      remoteJid: '174126580912330@lid',
      remoteJidAlt: '553171210720@s.whatsapp.net',
    },
    message: { conversation: 'oi' },
    messageTimestamp: 1787255071,
  };

  it('carrega o telefone junto da linha da mensagem', () => {
    expect(normalizar(base as never, 'Emmanuel')?.telefone).toBe('553171210720');
  });

  it('mantem o remote_jid como o @lid, que e a identidade da conversa', () => {
    expect(normalizar(base as never, 'Emmanuel')?.remote_jid).toBe('174126580912330@lid');
  });
});
