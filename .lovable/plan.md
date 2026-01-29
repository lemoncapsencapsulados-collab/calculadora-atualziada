

## Plano: Sistema de Cores Dinâmico para Margem de Lucro com Celebração

### Objetivo
Ajustar as regras de validação de margem de lucro por tipo de produto, implementar cores dinâmicas (vermelho, amarelo, verde, dourado) no bloco de margem, e adicionar animação de celebração com estrelinhas e mensagem "VOCÊ VAI FAZER A LEMON RICA" quando a margem estiver acima do ideal.

---

### Novas Regras de Margem por Tipo de Produto (CORRIGIDO)

| Tipo Produto | Margem Mínima | Faixa Amarela | Faixa Ideal (Verde) | Acima Ideal (Dourado) |
|--------------|---------------|---------------|---------------------|----------------------|
| **Gummy** | 25% | - | 25.01% a 32% | > 32% |
| **Solúveis (Pó)** | **18%** | 18% a 19.99% | 20% a 25% | > 25% |
| **Encapsulados** | 15% | 15% a 17.99% | 18% a 23% | > 23% |
| **Líquidos** | 15% | 15% a 17.99% | 18% a 23% | > 23% |

**Cores:**
- **Vermelho**: Margem abaixo do mínimo
- **Amarelo**: Margem entre mínimo e início da faixa ideal
- **Verde**: Margem dentro da faixa ideal
- **Dourado + Celebração**: Margem acima da faixa ideal

---

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/lib/precificacaoCalculator.ts` | Adicionar função `validarMargemPorTipo` com 4 status |
| `src/pages/Precificacao.tsx` | Implementar cores dinâmicas e celebração no bloco de margem |
| `src/components/EditarPrecificacaoDialog.tsx` | Aplicar mesma lógica de cores e celebração |
| `src/components/PrecificacoesSalvas.tsx` | Aplicar mesma lógica de cores na lista |
| `src/index.css` | Adicionar animações CSS para brilho dourado e estrelinhas |

---

### Detalhes Técnicos

#### 1. Nova Função em precificacaoCalculator.ts

```typescript
const MARGENS_CONFIG = {
  'Gummy': { minima: 25, idealInicio: 25.01, idealFim: 32 },
  'Pó': { minima: 18, idealInicio: 20, idealFim: 25 },  // Mínima corrigida para 18%
  'Encapsulados': { minima: 15, idealInicio: 18, idealFim: 23 },
  'Líquido': { minima: 15, idealInicio: 18, idealFim: 23 },
};
```

Função retorna 4 possíveis status:
- `baixa` → Vermelho
- `aceitavel` → Amarelo  
- `ideal` → Verde
- `excelente` → Dourado com celebração

#### 2. Animações CSS

- `gold-shimmer`: Gradiente dourado animado para o fundo
- `sparkle`: Animação de estrelinhas pulsando nos cantos

#### 3. Celebração "LEMON RICA"

Quando margem acima do ideal:
- Fundo com brilho dourado animado
- 4-5 ícones de estrelas (`Sparkles`, `Star`) nos cantos com animação
- Texto "VOCÊ VAI FAZER A LEMON RICA" pulsando

---

### Resumo Visual

```text
┌─────────────────────────────────────┐
│     MARGEM BAIXA (Vermelho)         │
│  Fundo vermelho claro               │
│  "Margem abaixo do mínimo!"         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│    MARGEM ACEITÁVEL (Amarelo)       │
│  Fundo amarelo claro                │
│  "Margem aceitável. Ideal: X% a Y%" │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      MARGEM IDEAL (Verde)           │
│  Fundo verde claro                  │
│  "Excelente! Margem ideal!"         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ✨  MARGEM EXCELENTE (Dourado)  ✨  │
│ ⭐ Fundo com brilho dourado     ⭐  │
│                                     │
│   "VOCÊ VAI FAZER A LEMON RICA"     │
│         (texto pulsando)            │
└─────────────────────────────────────┘
```

---

### Atualização do Banco de Dados

```sql
UPDATE margens_lucro SET margem_minima = 25, margem_ideal = 32 WHERE tipo_produto = 'Gummy';
UPDATE margens_lucro SET margem_minima = 18, margem_ideal = 25 WHERE tipo_produto = 'Pó';
UPDATE margens_lucro SET margem_minima = 15, margem_ideal = 23 WHERE tipo_produto = 'Encapsulados';
UPDATE margens_lucro SET margem_minima = 15, margem_ideal = 23 WHERE tipo_produto = 'Líquido';
```

