import { describe, expect, it } from 'vitest';
import { normalizar } from './zapNormalizar.ts';

/**
 * As colunas que `zap_mensagens` tem de verdade, conferidas no banco em
 * 05/10/2026. `transcrito_em`, `transcricao_status` e `created_at` existem mas
 * não são escritas pela ingestão: a transcrição vem depois, por outro caminho.
 */
const COLUNAS_ZAP_MENSAGENS = new Set([
  'instance_name',
  'id',
  'remote_jid',
  'from_me',
  'momento',
  'tipo',
  'texto',
  'duracao_segundos',
  'dominios_links',
  'transcrito_em',
  'transcricao_status',
  'created_at',
]);

/** Mensagem no formato novo da Evolution: o número vem no `remoteJidAlt`. */
const mensagemComTelefone = {
  key: {
    id: 'ABC123',
    remoteJid: '218471234567890@lid',
    remoteJidAlt: '5511999998888@s.whatsapp.net',
    fromMe: false,
  },
  messageTimestamp: 1757000000,
  message: { conversation: 'bom dia, queria um orçamento' },
};

describe('a linha normalizada', () => {
  it('traz o telefone para quem atualiza o contato', () => {
    const l = normalizar(mensagemComTelefone as any, 'EVERTON')!;
    expect(l.telefone).toBe('5511999998888');
  });

  it('o telefone NÃO é coluna de zap_mensagens', () => {
    // O ponto do teste: `telefone` viaja ao lado da mensagem de propósito, mas
    // a tabela não o tem. Quem grava precisa separar os dois.
    expect(COLUNAS_ZAP_MENSAGENS.has('telefone')).toBe(false);
  });
});

describe('o que vai para o upsert de zap_mensagens', () => {
  /**
   * Reproduz a projeção de `paraColunasDaTabela`. Não é importada porque
   * `zapPersistir.ts` abre `npm:@supabase/supabase-js` no topo, um especificador
   * de Deno que o Vitest não resolve. O valor aqui é travar o CONTRATO: se
   * alguém puser um campo novo na linha e ele chegar ao upsert, o teste cai.
   */
  const projetar = (l: any) => ({
    instance_name: l.instance_name,
    id: l.id,
    remote_jid: l.remote_jid,
    from_me: l.from_me,
    momento: l.momento,
    tipo: l.tipo,
    texto: l.texto,
    duracao_segundos: l.duracao_segundos,
    dominios_links: l.dominios_links,
  });

  it('manda só colunas que existem na tabela', () => {
    // A regressão real: em 01/09/2026 a ingestão passou a mandar o objeto
    // inteiro, a PostgREST recusou o lote com "Could not find the 'telefone'
    // column of 'zap_mensagens' in the schema cache", 447 conversas foram para
    // a dlq e o WhatsApp ficou 34 dias sem sincronizar. O painel, enquanto
    // isso, mostrava zero -- que se lê como consultor sem atendimento.
    const l = normalizar(mensagemComTelefone as any, 'EVERTON')!;
    for (const coluna of Object.keys(projetar(l))) {
      expect(COLUNAS_ZAP_MENSAGENS, `coluna inexistente no upsert: ${coluna}`).toContain(coluna);
    }
  });

  it('deixa o telefone de fora', () => {
    const l = normalizar(mensagemComTelefone as any, 'EVERTON')!;
    expect(l.telefone).toBeTruthy();
    expect(projetar(l)).not.toHaveProperty('telefone');
  });

  it('não perde nenhum dado da mensagem no caminho', () => {
    // A projeção não pode virar desculpa para engolir campo útil: tudo que a
    // linha traz e a tabela aceita precisa chegar lá.
    const l = normalizar(mensagemComTelefone as any, 'EVERTON')!;
    const projetado = projetar(l);
    for (const [chave, valor] of Object.entries(l)) {
      if (!COLUNAS_ZAP_MENSAGENS.has(chave)) continue;
      expect(projetado[chave as keyof typeof projetado]).toEqual(valor);
    }
  });
});
