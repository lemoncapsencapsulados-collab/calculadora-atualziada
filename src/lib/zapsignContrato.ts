export type ZapSignReplacement = { de: string; para: string };

export const ZAPSIGN_ALIAS_GROUPS: string[][] = [
  ['{{RAZAO_SOCIAL_CONTRATANTE}}', '{{RAZÃO_SOCIAL_CONTRATANTE}}', '{{RAZAO SOCIAL CONTRATANTE}}', '{{RAZÃO SOCIAL CONTRATANTE}}', '{{NOME_CONTRATANTE}}', '{{NOME CONTRATANTE}}'],
  ['{{CNPJ_CONTRATANTE}}', '{{CPF_CNPJ_CONTRATANTE}}', '{{CNPJ CONTRATANTE}}', '{{CPF/CNPJ CONTRATANTE}}'],
  ['{{ENDERECO_CONTRATANTE}}', '{{ENDEREÇO_CONTRATANTE}}', '{{ENDERECO CONTRATANTE}}', '{{ENDEREÇO CONTRATANTE}}'],
  ['{{ENDERECO_REPRESENTANTE}}', '{{ENDEREÇO_REPRESENTANTE}}', '{{ENDERECO REPRESENTANTE}}', '{{ENDEREÇO REPRESENTANTE}}'],
  ['{{EMAIL_CONTRATANTE}}', '{{E-MAIL_CONTRATANTE}}', '{{EMAIL CONTRATANTE}}'],
  ['{{TELEFONE_CONTRATANTE}}', '{{TELEFONE CONTRATANTE}}'],
  ['{{NOME_REPRESENTANTE}}', '{{NOME REPRESENTANTE}}', '{{REPRESENTANTE_LEGAL}}', '{{REPRESENTANTE LEGAL}}'],
  ['{{CPF_REPRESENTANTE}}', '{{CPF REPRESENTANTE}}'],
  ['{{NUMERO_ORCAMENTO}}', '{{NÚMERO_ORÇAMENTO}}', '{{NUMERO ORCAMENTO}}', '{{NÚMERO ORÇAMENTO}}', '{{NUMERO_CONTRATO}}', '{{NÚMERO_CONTRATO}}', '{{NUMERO CONTRATO}}', '{{Nº_CONTRATO}}', '{{N_CONTRATO}}'],
  ['{{DATA_CONTRATO}}', '{{DATA CONTRATO}}'],
  ['{{PRODUTO_DESCRICAO}}', '{{PRODUTO_DESCRIÇÃO}}', '{{PRODUTO DESCRICAO}}', '{{PRODUTO}}'],
  ['{{PRODUTO_APRESENTACAO}}', '{{PRODUTO_APRESENTAÇÃO}}'],
  ['{{PRODUTO_PRECO}}', '{{PRODUTO_PREÇO}}', '{{PRODUTO_PRECO_UNIT}}', '{{PRODUTO_PREÇO_UNIT}}'],
  ['{{VALOR_PRODUCAO}}', '{{VALOR_PRODUÇÃO}}'],
  ['{{VALOR_PRODUCAO_EXTENSO}}', '{{VALOR_PRODUÇÃO_EXTENSO}}'],
  ['{{VALOR_TOTAL_PROJETO}}', '{{VALOR_TOTAL_PEDIDO}}', '{{VALOR_TOTAL}}', '{{VALOR TOTAL}}'],
  ['{{VALOR_TOTAL_PROJETO_EXTENSO}}', '{{VALOR_TOTAL_EXTENSO}}'],
  ['{{CONDICAO_PAGAMENTO}}', '{{CONDIÇÃO_PAGAMENTO}}', '{{CONDICAO PAGAMENTO}}', '{{CONDIÇÃO PAGAMENTO}}'],
  ['{{PRAZO_PRODUCAO}}', '{{PRAZO_PRODUÇÃO}}'],
  ['{{PRAZO_ROTULOS}}', '{{PRAZO_RÓTULOS}}'],
];

export interface ZapSignContratoCampos {
  signer_name: string;
  signer_email: string;
  signer_phone_number: string;
  razao_social: string;
  cnpj: string;
  endereco: string;
  endereco_representante: string;
  email_contratante: string;
  telefone_contratante: string;
  nome_representante: string;
  cpf_representante: string;
  numero_contrato: string;
  data_contrato: string;
  produto_descricao: string;
  produto_apresentacao: string;
  produto_preco_unit: string;
  produto_quantidade: string;
  produto_valor_total: string;
  valor_setup: string;
  valor_setup_extenso: string;
  valor_producao: string;
  valor_producao_extenso: string;
  valor_total: string;
  valor_total_extenso: string;
  valor_total_pedido: string;
  condicao_pagamento: string;
  prazo_producao: string;
  prazo_rotulos: string;
  anexo_produto_nome: string;
  anexo_qtd_frasco: string;
  anexo_dose_diaria: string;
  anexo_ativo_1: string;
  anexo_ativo_2: string;
  anexo_cor_pote: string;
  anexo_cor_tampa: string;
  anexo_cor_gummy: string;
  anexo_sabor_gummy: string;
  anexo_quantidade: string;
  anexo_preco_unitario: string;
}

const texto = (valor: unknown) => String(valor ?? '').trim();

const par = (de: string, para: unknown): ZapSignReplacement => ({ de, para: texto(para) });

export function formatarInsumoContrato(insumo: { nome?: string; quantidade?: number; unidade?: string } | null | undefined): string {
  if (!insumo?.nome) return '';
  const nomeNormalizado = insumo.nome.trim().toLowerCase();
  const nome = nomeNormalizado === 'amido de milho' ? 'Excipiente' : insumo.nome.trim();
  const qtd = insumo.quantidade != null ? String(insumo.quantidade).replace('.', ',') : '';
  const unidade = insumo.unidade || '';
  return [nome, [qtd, unidade].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
}

export function montarDadosZapSign(campos: ZapSignContratoCampos): ZapSignReplacement[] {
  return [
    par('{{RAZAO_SOCIAL_CONTRATANTE}}', campos.razao_social),
    par('{{RAZÃO_SOCIAL_CONTRATANTE}}', campos.razao_social),
    par('{{RAZAO SOCIAL CONTRATANTE}}', campos.razao_social),
    par('{{RAZÃO SOCIAL CONTRATANTE}}', campos.razao_social),
    par('{{NOME_CONTRATANTE}}', campos.razao_social),
    par('{{NOME CONTRATANTE}}', campos.razao_social),
    par('{{CNPJ_CONTRATANTE}}', campos.cnpj),
    par('{{CPF_CNPJ_CONTRATANTE}}', campos.cnpj),
    par('{{CNPJ CONTRATANTE}}', campos.cnpj),
    par('{{CPF/CNPJ CONTRATANTE}}', campos.cnpj),
    par('{{ENDERECO_CONTRATANTE}}', campos.endereco),
    par('{{ENDEREÇO_CONTRATANTE}}', campos.endereco),
    par('{{ENDERECO CONTRATANTE}}', campos.endereco),
    par('{{ENDEREÇO CONTRATANTE}}', campos.endereco),
    par('{{ENDERECO_REPRESENTANTE}}', campos.endereco_representante),
    par('{{ENDEREÇO_REPRESENTANTE}}', campos.endereco_representante),
    par('{{ENDERECO REPRESENTANTE}}', campos.endereco_representante),
    par('{{ENDEREÇO REPRESENTANTE}}', campos.endereco_representante),
    par('{{EMAIL_CONTRATANTE}}', campos.email_contratante),
    par('{{E-MAIL_CONTRATANTE}}', campos.email_contratante),
    par('{{EMAIL CONTRATANTE}}', campos.email_contratante),
    par('{{TELEFONE_CONTRATANTE}}', campos.telefone_contratante),
    par('{{TELEFONE CONTRATANTE}}', campos.telefone_contratante),
    par('{{NOME_REPRESENTANTE}}', campos.nome_representante),
    par('{{NOME REPRESENTANTE}}', campos.nome_representante),
    par('{{REPRESENTANTE_LEGAL}}', campos.nome_representante),
    par('{{REPRESENTANTE LEGAL}}', campos.nome_representante),
    par('{{CPF_REPRESENTANTE}}', campos.cpf_representante),
    par('{{CPF REPRESENTANTE}}', campos.cpf_representante),
    par('{{NUMERO_ORCAMENTO}}', campos.numero_contrato),
    par('{{NÚMERO_ORÇAMENTO}}', campos.numero_contrato),
    par('{{NUMERO ORCAMENTO}}', campos.numero_contrato),
    par('{{NÚMERO ORÇAMENTO}}', campos.numero_contrato),
    par('{{NUMERO_CONTRATO}}', campos.numero_contrato),
    par('{{NÚMERO_CONTRATO}}', campos.numero_contrato),
    par('{{NUMERO CONTRATO}}', campos.numero_contrato),
    par('{{Nº_CONTRATO}}', campos.numero_contrato),
    par('{{N_CONTRATO}}', campos.numero_contrato),
    par('{{DATA_CONTRATO}}', campos.data_contrato),
    par('{{DATA CONTRATO}}', campos.data_contrato),
    par('{{PRODUTO_DESCRICAO}}', campos.produto_descricao),
    par('{{PRODUTO_DESCRIÇÃO}}', campos.produto_descricao),
    par('{{PRODUTO DESCRICAO}}', campos.produto_descricao),
    par('{{PRODUTO}}', campos.produto_descricao),
    par('{{PRODUTO_APRESENTACAO}}', campos.produto_apresentacao),
    par('{{PRODUTO_APRESENTAÇÃO}}', campos.produto_apresentacao),
    par('{{PRODUTO_PRECO}}', campos.produto_preco_unit),
    par('{{PRODUTO_PREÇO}}', campos.produto_preco_unit),
    par('{{PRODUTO_PRECO_UNIT}}', campos.produto_preco_unit),
    par('{{PRODUTO_PREÇO_UNIT}}', campos.produto_preco_unit),
    par('{{PRODUTO_QUANTIDADE}}', campos.produto_quantidade),
    par('{{PRODUTO_VALOR_TOTAL}}', campos.produto_valor_total),
    par('{{VALOR_SETUP}}', campos.valor_setup),
    par('{{VALOR_SETUP_EXTENSO}}', campos.valor_setup_extenso),
    par('{{VALOR_PRODUCAO}}', campos.valor_producao),
    par('{{VALOR_PRODUÇÃO}}', campos.valor_producao),
    par('{{VALOR_PRODUCAO_EXTENSO}}', campos.valor_producao_extenso),
    par('{{VALOR_PRODUÇÃO_EXTENSO}}', campos.valor_producao_extenso),
    par('{{VALOR_TOTAL_PROJETO}}', campos.valor_total),
    par('{{VALOR_TOTAL_PEDIDO}}', campos.valor_total_pedido || campos.valor_total),
    par('{{VALOR_TOTAL}}', campos.valor_total),
    par('{{VALOR TOTAL}}', campos.valor_total),
    par('{{VALOR_TOTAL_PROJETO_EXTENSO}}', campos.valor_total_extenso),
    par('{{VALOR_TOTAL_EXTENSO}}', campos.valor_total_extenso),
    par('{{CONDICAO_PAGAMENTO}}', campos.condicao_pagamento),
    par('{{CONDIÇÃO_PAGAMENTO}}', campos.condicao_pagamento),
    par('{{CONDICAO PAGAMENTO}}', campos.condicao_pagamento),
    par('{{CONDIÇÃO PAGAMENTO}}', campos.condicao_pagamento),
    par('{{PRAZO_PRODUCAO}}', campos.prazo_producao),
    par('{{PRAZO_PRODUÇÃO}}', campos.prazo_producao),
    par('{{PRAZO_ROTULOS}}', campos.prazo_rotulos),
    par('{{PRAZO_RÓTULOS}}', campos.prazo_rotulos),
    par('{{ANEXO_PRODUTO_NOME}}', campos.anexo_produto_nome),
    par('{{ANEXO_QTD_FRASCO}}', campos.anexo_qtd_frasco),
    par('{{ANEXO_DOSE_DIARIA}}', campos.anexo_dose_diaria),
    par('{{ANEXO_ATIVO_1}}', campos.anexo_ativo_1),
    par('{{ANEXO_ATIVO_2}}', campos.anexo_ativo_2),
    par('{{ANEXO_COR_POTE}}', campos.anexo_cor_pote),
    par('{{ANEXO_COR_TAMPA}}', campos.anexo_cor_tampa),
    par('{{ANEXO_COR_GUMMY}}', campos.anexo_cor_gummy),
    par('{{ANEXO_SABOR_GUMMY}}', campos.anexo_sabor_gummy),
    par('{{ANEXO_QUANTIDADE}}', campos.anexo_quantidade),
    par('{{ANEXO_PRECO_UNITARIO}}', campos.anexo_preco_unitario),
  ];
}