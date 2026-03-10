

# Plano: Reestruturar aprovação de orçamento

## 1. Detalhes de produção — todos os tipos precisam cor do pote e tampa

**`src/components/AprovacaoOrcamentoDialog.tsx`** (seção 2 - Detalhes do Produto)
- Todos os segmentos (Encapsulado, Gummy, Líquido, Solúvel) passam a exigir **Cor do Pote** e **Cor da Tampa**
- Gummy, Líquido e Solúvel mantêm campos de **Sabor** e **Cor do Conteúdo** (renomear labels para "Cor do Conteúdo")
- Atualizar validação `handleConfirmAprovacao` para exigir `cor_pote` e `cor_tampa` em todos os segmentos

## 2. Frete — envio total ao produtor desabilita logística LemonCaps (com edição)

**`src/components/AprovacaoOrcamentoDialog.tsx`** (seção 4 - Frete)
- Quando `detalhamentoEnvio.tipo === 'total_produtor'`, setar `freteLemonCaps = false` automaticamente
- Manter os campos de frete visíveis mas com valor default "Não" (permitindo edição manual)

## 3. Informações do cliente — PJ vs PF com campos completos

**`src/types/orcamento.ts`** — Expandir `DadosCliente`:
```typescript
export interface PessoaFisicaResponsavel {
  nome?: string;
  cpf?: string;
  rg?: string;
  endereco?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  email?: string;
  estado_civil?: string;
}

export interface DadosCliente {
  tipo_pessoa: 'pj' | 'pf';
  // PJ
  cnpj?: string;
  razao_social?: string;
  inscricao_municipal?: string;
  inscricao_estadual?: string;
  endereco_cnpj?: string;
  cep_cnpj?: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  email?: string;
  // PJ - responsável PF (QSA)
  responsavel_pj?: PessoaFisicaResponsavel;
  // PF - lista de pessoas físicas
  pessoas_fisicas?: PessoaFisicaResponsavel[];
  // Legados (manter compatibilidade)
  nome_completo?: string;
  cpf?: string;
  forma_venda?: 'locais_fisicos' | 'venda_digital' | 'ambas' | 'sem_informacao';
}
```

**`src/components/AprovacaoOrcamentoDialog.tsx`** (seção 1 - Informações do Cliente):
- Adicionar Select no topo: "Pessoa Jurídica" ou "Pessoa Física"
- **PJ**: CNPJ (com busca), Razão Social, Inscrição Municipal, Inscrição Estadual (opcional), Endereço, CEP, Cidade, Estado, Telefone, Email NF + seção "Responsável PF (QSA)" com campos: Nome, CPF, RG, Endereço, CEP, Cidade, Estado, Telefone, Email, Estado Civil
- **PF**: Lista dinâmica de pessoas físicas (botão "Adicionar Pessoa"), cada uma com: Nome, CPF, RG, Endereço, CEP, Cidade, Estado, Telefone, Email, Estado Civil. Sem campos de CNPJ.
- Todos os campos obrigatórios exceto Inscrição Estadual e Inscrição Municipal
- Atualizar validação de campos obrigatórios conforme tipo_pessoa

**`src/components/InformacoesClienteDialog.tsx`** — Aplicar mesma estrutura PJ/PF para manter consistência

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/types/orcamento.ts` | Expandir `DadosCliente`, adicionar `PessoaFisicaResponsavel` |
| `src/components/AprovacaoOrcamentoDialog.tsx` | Cor pote/tampa para todos, frete auto, formulário PJ/PF completo |
| `src/components/InformacoesClienteDialog.tsx` | Mesma estrutura PJ/PF |

