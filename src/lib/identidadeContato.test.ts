import { describe, expect, it } from 'vitest';
import {
  ehLid,
  finalDoIdentificador,
  formatarTelefoneBr,
  identidadeDoContato,
  nomeUtilizavel,
  telefoneDoJid,
  textoDeBusca,
} from './identidadeContato';

/** O caso que motivou o módulo: Leonardo Cesar, na conta do Guilherme. */
const LID_LEONARDO = '201894198833332@lid';

describe('um @lid não é telefone', () => {
  it('reconhece o identificador', () => {
    expect(ehLid(LID_LEONARDO)).toBe(true);
    expect(ehLid('5565999887766@s.whatsapp.net')).toBe(false);
  });

  it('não devolve telefone para um @lid', () => {
    // Era o defeito: 201894198833332 virava "telefone" na tela, com 15 dígitos.
    expect(telefoneDoJid(LID_LEONARDO)).toBeNull();
  });

  it('devolve telefone só do JID que carrega um', () => {
    expect(telefoneDoJid('5565999887766@s.whatsapp.net')).toBe('5565999887766');
    expect(telefoneDoJid('5565999887766@c.us')).toBe('5565999887766');
    expect(telefoneDoJid('120363000000000000@g.us')).toBeNull();
    expect(telefoneDoJid(null)).toBeNull();
  });

  it('recusa um @lid do tamanho de um telefone', () => {
    // O caso perigoso. O identificador do Leonardo tem 15 dígitos e cairia
    // pelo tamanho, mas o `@lid` não tem comprimento fixo: um de 13 dígitos
    // passaria por telefone e casaria a conversa com o cliente ERRADO no CRM,
    // mostrando pedidos de outra pessoa ao lado da conversa. Quem barra isso é
    // o domínio do JID, não o tamanho.
    expect(telefoneDoJid('5565999887766@lid')).toBeNull();
    expect(telefoneDoJid('6599887766@lid')).toBeNull();
    expect(
      identidadeDoContato({ remoteJid: '5565999887766@lid' }).temTelefone
    ).toBe(false);
  });

  it('recusa comprimento que não é de telefone', () => {
    expect(telefoneDoJid('123@s.whatsapp.net')).toBeNull();
    expect(telefoneDoJid('20189419883333299@s.whatsapp.net')).toBeNull();
  });
});

describe('nome que serve para chamar alguém', () => {
  it('recusa número disfarçado de nome', () => {
    expect(nomeUtilizavel('201894198833332')).toBeNull();
    expect(nomeUtilizavel('+55 65 99988-7766')).toBeNull();
  });

  it('recusa "Você", que é o rótulo do próprio consultor', () => {
    expect(nomeUtilizavel('Você')).toBeNull();
    expect(nomeUtilizavel('voce')).toBeNull();
  });

  it('aceita nome de gente', () => {
    expect(nomeUtilizavel('  Leonardo Cesar ')).toBe('Leonardo Cesar');
  });
});

describe('a identificação na tela', () => {
  it('prefere o nome do cliente do CRM', () => {
    const i = identidadeDoContato({
      remoteJid: LID_LEONARDO,
      pushName: 'Leo',
      nomeCliente: 'Leonardo Cesar Ltda',
      telefoneConhecido: '5565999887766',
    });
    expect(i.titulo).toBe('Leonardo Cesar Ltda');
    expect(i.detalhe).toBe('(65) 99988-7766');
    expect(i.temTelefone).toBe(true);
  });

  it('cai para o nome público do WhatsApp', () => {
    const i = identidadeDoContato({ remoteJid: LID_LEONARDO, pushName: 'Leonardo Cesar' });
    expect(i.titulo).toBe('Leonardo Cesar');
  });

  it('cai para o telefone quando não há nome', () => {
    const i = identidadeDoContato({ remoteJid: LID_LEONARDO, telefoneConhecido: '5565999887766' });
    expect(i.titulo).toBe('(65) 99988-7766');
    expect(i.temTelefone).toBe(true);
  });

  it('sem nome e sem telefone, identifica sem inventar número', () => {
    // A conversa CONTINUA na lista -- só para de exibir o identificador
    // interno como se fosse telefone.
    const i = identidadeDoContato({ remoteJid: LID_LEONARDO });
    expect(i.titulo).toBe('Contato ·3332');
    expect(i.titulo).not.toContain('201894198833332');
    expect(i.detalhe).toBe('Sem número: contato oculto pelo WhatsApp');
    expect(i.temTelefone).toBe(false);
    expect(i.anonimo).toBe(true);
  });

  it('nunca devolve título vazio', () => {
    for (const jid of [LID_LEONARDO, '', null, undefined, '@lid', 'x@s.whatsapp.net']) {
      expect(identidadeDoContato({ remoteJid: jid }).titulo.length).toBeGreaterThan(0);
    }
  });

  it('dois contatos sem nome não viram o mesmo rótulo', () => {
    const a = identidadeDoContato({ remoteJid: '201894198833332@lid' });
    const b = identidadeDoContato({ remoteJid: '170162930077892@lid' });
    expect(a.titulo).not.toBe(b.titulo);
  });

  it('grupo é grupo, não contato sem número', () => {
    const i = identidadeDoContato({
      remoteJid: '120363000000000000@g.us',
      pushName: 'GERENCIAMENTO DE LEADS',
    });
    expect(i.titulo).toBe('GERENCIAMENTO DE LEADS');
    expect(i.detalhe).toBe('Conversa em grupo');
    expect(i.anonimo).toBe(false);
  });
});

describe('telefone legível', () => {
  it('formata celular e fixo, com e sem 55', () => {
    expect(formatarTelefoneBr('5565999887766')).toBe('(65) 99988-7766');
    expect(formatarTelefoneBr('65999887766')).toBe('(65) 99988-7766');
    expect(formatarTelefoneBr('6532234455')).toBe('(65) 3223-4455');
  });

  it('não desfigura o que não reconhece', () => {
    expect(formatarTelefoneBr('123')).toBe('123');
    expect(formatarTelefoneBr('')).toBe('');
  });
});

describe('a busca não perde conversa nenhuma', () => {
  it('acha pelo identificador colado de outro lugar', () => {
    const texto = textoDeBusca({ remoteJid: LID_LEONARDO, pushName: 'Leonardo Cesar' });
    expect(texto).toContain('201894198833332');
    expect(texto).toContain('leonardo cesar');
  });

  it('acha pelo telefone descoberto, que não está no JID', () => {
    const texto = textoDeBusca({ remoteJid: LID_LEONARDO, telefoneConhecido: '5565999887766' });
    expect(texto).toContain('5565999887766');
  });
});

describe('final do identificador', () => {
  it('são os últimos quatro dígitos', () => {
    expect(finalDoIdentificador(LID_LEONARDO)).toBe('3332');
    expect(finalDoIdentificador('')).toBe('');
  });
});
