

# Plano: Dropdowns para Estado Civil/Cidade/Estado + Cores condicionais por segmento

## 1. Criar arquivo utilitário com dados brasileiros

**Novo arquivo**: `src/lib/brasilData.ts`
- Lista dos 27 estados (UF + nome)
- Opções de estado civil: Solteiro(a), Casado(a), Divorciado(a), Viúvo(a), Separado(a), União Estável
- Função `fetchCidadesPorUF(uf: string)` que consulta a API do IBGE (`https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios`) e retorna lista de cidades ordenadas

## 2. Refatorar `PessoaFisicaFields` em ambos os arquivos

**Arquivos**: `AprovacaoOrcamentoDialog.tsx` e `InformacoesClienteDialog.tsx`

Substituir os campos de texto por dropdowns:

- **Estado Civil**: `Select` com opções fixas (Solteiro(a), Casado(a), etc.)
- **Estado (UF)**: `Select` com 27 UFs brasileiras
- **Cidade**: `Select` que carrega cidades via IBGE API quando UF muda. Usar `useState` + `useEffect` internos ao componente para buscar cidades. Mostrar "Selecione o estado primeiro" quando UF não selecionada. Limpar cidade quando UF mudar.

## 3. Campos Cidade/Estado do PJ (dados da empresa)

**Arquivo**: `AprovacaoOrcamentoDialog.tsx` (linhas 408-414) e `InformacoesClienteDialog.tsx`

Mesma lógica: Estado vira Select com UFs, Cidade vira Select filtrado por UF via IBGE API.

## 4. Cores do pote e tampa condicionais por segmento

**Arquivo**: `AprovacaoOrcamentoDialog.tsx` (linhas 500-524)

Substituir as opções fixas por opções dinâmicas baseadas no segmento:

| Opção | Encapsulado | Gummy | Líquido | Solúvel |
|---|---|---|---|---|
| **Pote Preto** | Sim | Não | Sim | Sim |
| **Pote Transparente** | Sim | Sim | Sim | Não |
| **Tampa Preta** | Sim | Não | Sim | Sim |
| **Tampa Branca** | Sim | Sim | Não | Não |

Implementar como funções que retornam as opções disponíveis:
```typescript
const getOpcoesPote = (seg) => {
  // Encapsulado: Preto, Transparente
  // Gummy: Transparente
  // Líquido: Preto, Transparente
  // Solúvel: Preto
};
const getOpcoesTampa = (seg) => {
  // Encapsulado: Preta, Branca
  // Gummy: Branca
  // Líquido: Preta
  // Solúvel: Preta
};
```

Quando só há 1 opção, pré-selecionar automaticamente.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/brasilData.ts` | Novo — UFs, estados civis, fetch cidades IBGE |
| `src/components/AprovacaoOrcamentoDialog.tsx` | Dropdowns PF/PJ + cores condicionais |
| `src/components/InformacoesClienteDialog.tsx` | Dropdowns PF/PJ |

