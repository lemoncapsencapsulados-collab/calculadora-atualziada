import { describe, expect, it } from 'vitest';
import { nomeArquivoDocumento, nomeArquivoOrcamentoCliente } from './nomeArquivo';

const quando = new Date(2026, 8, 19, 9, 5); // 19/09/2026 09:05

describe('nome do arquivo baixado', () => {
  it('segue [Cliente]_[Documento]_[Data]_[Hora]', () => {
    expect(nomeArquivoDocumento('Bio Princess', 'Contrato', quando))
      .toBe('Bio-Princess_Contrato_19-09-2026_09h05.pdf');
  });

  it('usa a hora do download, não a do documento', () => {
    const tarde = new Date(2026, 8, 19, 17, 42);
    expect(nomeArquivoDocumento('Bio Princess', 'Pedido-De-Compra', tarde))
      .toBe('Bio-Princess_Pedido-De-Compra_19-09-2026_17h42.pdf');
  });

  it('tira acento do nome do cliente', () => {
    expect(nomeArquivoDocumento('Nutrição Máxima', 'Contrato', quando))
      .toBe('Nutricao-Maxima_Contrato_19-09-2026_09h05.pdf');
  });

  it('remove o que o sistema de arquivos recusa', () => {
    // Barra viraria diretório; dois-pontos quebra no Windows.
    expect(nomeArquivoDocumento('Lemon / Caps: Ltda', 'Contrato', quando))
      .toBe('Lemon-Caps-Ltda_Contrato_19-09-2026_09h05.pdf');
  });

  it('não deixa o nome começar com separador quando o cliente é vazio', () => {
    expect(nomeArquivoDocumento('', 'Contrato', quando))
      .toBe('Cliente_Contrato_19-09-2026_09h05.pdf');
  });

  it('zera à esquerda dia, mês e hora', () => {
    const cedo = new Date(2026, 0, 3, 8, 7);
    expect(nomeArquivoDocumento('X', 'Contrato', cedo))
      .toBe('X_Contrato_03-01-2026_08h07.pdf');
  });
});

describe('nome do orçamento do cliente', () => {
  it('leva o cliente e a data do orçamento', () => {
    expect(nomeArquivoOrcamentoCliente('Bio Princess', '2026-09-14T15:59:00Z'))
      .toMatch(/^Bio-Princess_Orcamento_\d{2}-\d{2}-2026\.pdf$/);
  });

  it('usa a data do orçamento, não a de hoje', () => {
    // Rebaixar a mesma proposta tem que produzir o mesmo arquivo.
    const a = nomeArquivoOrcamentoCliente('X', new Date(2026, 0, 5));
    const b = nomeArquivoOrcamentoCliente('X', new Date(2026, 0, 5));
    expect(a).toBe('X_Orcamento_05-01-2026.pdf');
    expect(b).toBe(a);
  });

  it('cai para hoje quando a data é inválida', () => {
    expect(nomeArquivoOrcamentoCliente('X', 'data-quebrada'))
      .toMatch(/^X_Orcamento_\d{2}-\d{2}-\d{4}\.pdf$/);
    expect(nomeArquivoOrcamentoCliente('X', null))
      .toMatch(/^X_Orcamento_\d{2}-\d{2}-\d{4}\.pdf$/);
  });

  it('higieniza o nome do cliente igual ao outro documento', () => {
    expect(nomeArquivoOrcamentoCliente('Nutrição / Máxima', new Date(2026, 8, 21)))
      .toBe('Nutricao-Maxima_Orcamento_21-09-2026.pdf');
  });
});
