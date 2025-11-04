import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dicionário de aliases para matching inteligente
const ALIASES: Record<string, string> = {
  "creatina monoidratada": "creatina monohidratada",
  "colageno tipo 2": "colageno tipo ii",
  "colageno tipo ii": "colageno tipo ii",
  "vitamina c acido ascorbico": "acido ascorbico",
  "acido ascorbico": "acido ascorbico",
  "dioxido de silicio": "dioxido de silicio",
  "sacarina sodica": "sacarina sodica",
  "acido aspartico": "acido aspartico",
  "l taurina": "l taurina",
  "l-taurina": "l taurina",
  "l glicina": "l glicina",
  "glicine": "l glicina",
  "picolinato de cromo": "picolinato de cromo",
  "citrus sinensis laranja moro": "morosil",
  "oleo de abacate po": "oleo de abacate em po",
  "tcm liquido": "triglicerideos de cadeia media tcm",
  "resveratrol": "resveratrol",
  "teacrine": "teacrine",
  "fosfatidilserina": "fosfatidilserina",
  "acido hialuronico": "acido hialuronico",
  "aroma frutas vermelhas": "aroma de frutas vermelhas",
  "aroma limao siciliano": "aroma de limao siciliano",
  "aroma morango": "aroma de morango",
  "aroma acai": "aroma de acai",
  "aroma guarana": "aroma de guarana",
  "alfa amilase": "alfa amilase",
  "alfa galactosidase": "alfa galactosidase",
  "protease": "protease",
  "fitase": "fitase",
  "carbonato de calcio": "carbonato de calcio",
  "bisglicinato de magnesio": "bisglicinato de magnesio",
  "zinco quelato": "zinco quelato",
  "cobre bios": "cobre bios",
};

interface InsumoImport {
  nome: string;
  segmento?: string;
  preco_por_kg: number;
}

interface ImportResult {
  nome_original: string;
  normalized_name: string;
  acao: 'criado' | 'atualizado' | 'erro';
  id?: string;
  preco_convertido?: number;
  unidade_compra?: string;
  erro?: string;
  alias_aplicado?: string;
}

function normalizeInsumoName(nome: string): string {
  let result = nome.toLowerCase().trim();
  
  // Remover acentos manualmente (JavaScript não tem unaccent nativo)
  const accents: Record<string, string> = {
    'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ç': 'c', 'ñ': 'n',
  };
  
  result = result.replace(/[áàãâäéèêëíìîïóòõôöúùûüçñ]/g, (match) => accents[match] || match);
  
  // Substituir caracteres especiais por espaço
  result = result.replace(/[%/(),.-]/g, ' ');
  
  // Remover múltiplos espaços
  result = result.replace(/\s+/g, ' ');
  
  // Remover termos cosméticos
  result = result.replace(/\s+(po|liquido|em po|100%|99%|98%|95%|90%|80%|50%|35%|20%|8%)\s*/g, ' ');
  result = result.replace(/\s+(ext|extrato|soluvel)\s*/g, ' ');
  
  // Padronizar "tipo 2" para "tipo ii"
  result = result.replace(/tipo\s*2/g, 'tipo ii');
  
  // Remover espaços extras
  return result.replace(/\s+/g, ' ').trim();
}

function applyAliases(normalizedName: string): { final: string; aliasUsed?: string } {
  if (ALIASES[normalizedName]) {
    return { final: ALIASES[normalizedName], aliasUsed: normalizedName };
  }
  return { final: normalizedName };
}

function convertPriceFromKg(precoKg: number, unidadeCompra: string): number | null {
  switch (unidadeCompra) {
    case 'kg':
      return precoKg;
    case 'g':
      return precoKg / 1000;
    case 'mg':
      return precoKg / 1_000_000;
    case 'L':
      return precoKg; // Assumindo densidade 1
    case 'mL':
      return precoKg / 1000;
    case 'UI':
    case 'unidade':
      return null; // Não é possível converter
    default:
      return precoKg;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { itens } = await req.json() as { itens: InsumoImport[] };

    if (!Array.isArray(itens) || itens.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Campo "itens" deve ser um array não vazio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resultado: ImportResult[] = [];
    const alertas: string[] = [];
    let atualizados = 0;
    let criados = 0;
    let ignorados = 0;

    // Buscar todos os insumos existentes uma vez
    const { data: insumosExistentes, error: fetchError } = await supabase
      .from('insumos')
      .select('id, nome, normalized_name, unidade_compra, categoria');

    if (fetchError) {
      throw new Error(`Erro ao buscar insumos: ${fetchError.message}`);
    }

    // Processar cada item
    for (const item of itens) {
      try {
        // Validar preço
        if (!item.preco_por_kg || item.preco_por_kg <= 0) {
          resultado.push({
            nome_original: item.nome,
            normalized_name: '',
            acao: 'erro',
            erro: 'Preço inválido ou ausente',
          });
          alertas.push(`${item.nome}: Preço inválido (${item.preco_por_kg})`);
          ignorados++;
          continue;
        }

        // Normalizar nome
        const normalized = normalizeInsumoName(item.nome);
        const { final: normalizedWithAlias, aliasUsed } = applyAliases(normalized);

        // Buscar insumo existente
        const existente = insumosExistentes?.find(
          (ins: any) => ins.normalized_name === normalizedWithAlias
        );

        if (existente) {
          // Atualizar existente
          const precoConvertido = convertPriceFromKg(item.preco_por_kg, existente.unidade_compra);

          if (precoConvertido === null) {
            resultado.push({
              nome_original: item.nome,
              normalized_name: normalizedWithAlias,
              acao: 'erro',
              id: existente.id,
              erro: `Não é possível converter de kg para ${existente.unidade_compra}`,
            });
            alertas.push(`${item.nome}: Unidade ${existente.unidade_compra} não conversível de kg`);
            ignorados++;
            continue;
          }

          const updates: any = {
            preco_compra: precoConvertido,
            updated_at: new Date().toISOString(),
          };

          // Atualizar categoria se vazia
          if (item.segmento && !existente.categoria) {
            updates.categoria = item.segmento;
          }

          const { error: updateError } = await supabase
            .from('insumos')
            .update(updates)
            .eq('id', existente.id);

          if (updateError) throw updateError;

          resultado.push({
            nome_original: item.nome,
            normalized_name: normalizedWithAlias,
            acao: 'atualizado',
            id: existente.id,
            preco_convertido: precoConvertido,
            unidade_compra: existente.unidade_compra,
            alias_aplicado: aliasUsed,
          });

          if (aliasUsed) {
            alertas.push(`${item.nome}: Alias aplicado (${aliasUsed} → ${normalizedWithAlias})`);
          }

          atualizados++;
        } else {
          // Criar novo - usar kg como unidade padrão
          const novoInsumo = {
            nome: item.nome,
            unidade_compra: 'kg',
            preco_compra: item.preco_por_kg,
            categoria: item.segmento || null,
            // normalized_name será preenchido automaticamente pelo trigger
          };

          const { data: novoData, error: insertError } = await supabase
            .from('insumos')
            .insert(novoInsumo)
            .select()
            .single();

          if (insertError) throw insertError;

          resultado.push({
            nome_original: item.nome,
            normalized_name: normalizedWithAlias,
            acao: 'criado',
            id: novoData.id,
            preco_convertido: item.preco_por_kg,
            unidade_compra: 'kg',
            alias_aplicado: aliasUsed,
          });

          if (aliasUsed) {
            alertas.push(`${item.nome}: Alias aplicado (${aliasUsed} → ${normalizedWithAlias})`);
          }

          criados++;
        }
      } catch (error: any) {
        console.error(`Erro ao processar ${item.nome}:`, error);
        resultado.push({
          nome_original: item.nome,
          normalized_name: '',
          acao: 'erro',
          erro: error.message,
        });
        alertas.push(`${item.nome}: ${error.message}`);
        ignorados++;
      }
    }

    return new Response(
      JSON.stringify({
        resultado,
        resumo: {
          atualizados,
          criados,
          ignorados,
          alertas,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Erro na importação:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
