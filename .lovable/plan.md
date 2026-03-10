

# Plano: Validações, CEP API e correção de campos obrigatórios

## Bug identificado (campos obrigatórios "não preenchidos")

O Select de Cor da Tampa e Cor do Pote exibe visualmente o valor quando só há 1 opção (ex: Gummy → Transparente), mas **nunca chama `updateDetalhe`**, então o estado `detalhesProducao[idx]` fica vazio e a validação falha. Solução: adicionar `useEffect` que auto-preenche no estado quando só há 1 opção disponível.

## 1. Auto-preencher campos com opção única

**`AprovacaoOrcamentoDialog.tsx`**: Adicionar `useEffect` que percorre `itens_producao`, detecta segmentos com 1 opção de pote/tampa e chama `updateDetalhe` automaticamente ao montar o componente.

## 2. Validação de CPF, CNPJ e Email

**`src/lib/validators.ts`** (novo arquivo):
- `validarCPF(cpf: string): boolean` — algoritmo dos dígitos verificadores
- `validarCNPJ(cnpj: string): boolean` — algoritmo dos dígitos verificadores
- `validarEmail(email: string): boolean` — regex padrão

**`AprovacaoOrcamentoDialog.tsx`** e **`InformacoesClienteDialog.tsx`**:
- Na validação (`handleConfirmAprovacao` / `validatePF`), adicionar checagem: se CPF/CNPJ/Email estão preenchidos mas são inválidos, adicionar mensagem de erro específica (ex: "CPF inválido (Pessoa Física 1)")

## 3. CEP API para preencher cidade e estado

**`src/lib/brasilData.ts`**: Adicionar função `fetchEnderecoPorCEP(cep: string)` que consulta `https://viacep.com.br/ws/{cep}/json/` e retorna `{ logradouro, cidade, estado }`.

**`PessoaFisicaFields`**: Adicionar `useEffect` no campo CEP — quando CEP tiver 8 dígitos, buscar endereço e preencher automaticamente cidade, estado e endereço (permitindo edição posterior).

**Campos PJ** (CEP da empresa): Mesma lógica — ao digitar CEP, preencher cidade, estado e endereço da empresa.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/validators.ts` | Novo — validarCPF, validarCNPJ, validarEmail |
| `src/lib/brasilData.ts` | Adicionar fetchEnderecoPorCEP |
| `src/components/AprovacaoOrcamentoDialog.tsx` | useEffect auto-select, validações, CEP API |
| `src/components/InformacoesClienteDialog.tsx` | Validações e CEP API |

