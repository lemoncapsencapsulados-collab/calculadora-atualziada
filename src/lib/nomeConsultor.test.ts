import { describe, expect, it } from 'vitest';
import { chaveNome, resolverConsultor, type ConsultorCadastrado } from './nomeConsultor';

const cadastro: ConsultorCadastrado[] = [
  { nome: 'EMMANUEL MELANIO', instancia: 'Emmanuel' },
  { nome: 'EVERTON BARROS', instancia: 'EVERTON' },
  { nome: 'Guilherme Magano', instancia: 'guilherme magano' },
  { nome: 'RUBIA MARA', instancia: null },
  { nome: 'João Ferrari', instancia: null },
];

describe('um vendedor, um nome', () => {
  it('nome igual com outra caixa é a mesma pessoa', () => {
    expect(resolverConsultor('guilherme magano', cadastro)).toBe('Guilherme Magano');
    expect(resolverConsultor('Rubia Mara', cadastro)).toBe('RUBIA MARA');
  });

  it('acento não separa a pessoa', () => {
    expect(resolverConsultor('Joao Ferrari', cadastro)).toBe('João Ferrari');
  });

  it('o nome da instância do WhatsApp resolve para a pessoa', () => {
    // Era a causa da duplicação: leads vinham por "Emmanuel" e orçamentos por
    // "EMMANUEL MELANIO", virando duas linhas com metade dos números cada.
    expect(resolverConsultor('Emmanuel', cadastro)).toBe('EMMANUEL MELANIO');
    expect(resolverConsultor('EVERTON', cadastro)).toBe('EVERTON BARROS');
  });

  it('primeiro nome resolve quando serve a um cadastro só', () => {
    expect(resolverConsultor('Rubia', cadastro)).toBe('RUBIA MARA');
  });

  it('primeiro nome ambíguo NÃO junta', () => {
    // Juntar duas pessoas que compartilham o primeiro nome é pior que
    // deixá-las separadas: some faturamento de uma para a outra.
    const comDoisJoao = [...cadastro, { nome: 'João Pedro', instancia: null }];
    expect(resolverConsultor('João', comDoisJoao)).toBe('João');
  });

  it('quem não está no cadastro não some do relatório', () => {
    expect(resolverConsultor('Consultor Antigo', cadastro)).toBe('Consultor Antigo');
  });

  it('vazio continua vazio', () => {
    expect(resolverConsultor('', cadastro)).toBe('');
    expect(resolverConsultor(null, cadastro)).toBe('');
    expect(resolverConsultor('   ', cadastro)).toBe('');
  });

  it('cadastro vazio devolve o que veio', () => {
    expect(resolverConsultor('Fulano', [])).toBe('Fulano');
  });

  it('a chave ignora acento, caixa e espaço dobrado', () => {
    expect(chaveNome('  JOÃO   Ferrari ')).toBe('joao ferrari');
  });
});
