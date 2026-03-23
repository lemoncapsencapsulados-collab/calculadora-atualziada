import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é um especialista em extrair ingredientes de fórmulas de suplementos e medicamentos.

Analise a imagem fornecida e extraia TODOS os ingredientes/insumos com suas quantidades.

Formato de saída (uma linha por ingrediente):
NomeDoInsumo QuantidadeUnidade

Exemplo de saída:
Vitamina C 500mg
Zinco bisglicinato 15mg
Colágeno hidrolisado 300mg
D-Biotina 45mcg

REGRAS IMPORTANTES:
- Mantenha o nome completo do insumo como aparece na imagem
- Inclua a quantidade e unidade (mg, mcg, g, UI, etc) SEM espaço entre número e unidade
- Se houver informações entre parênteses no nome, mantenha-as
- Retorne APENAS a lista de ingredientes, sem explicações, títulos ou comentários
- Se não conseguir identificar ingredientes, retorne apenas: ERRO: Não foi possível identificar ingredientes na imagem
- Cada ingrediente deve estar em uma linha separada`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ success: false, error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { image } = await req.json();
    
    if (!image) {
      return new Response(
        JSON.stringify({ success: false, error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing image, length:", image.length);

    // Detect image type from base64 header or default to jpeg
    let mimeType = "image/jpeg";
    if (image.startsWith("/9j/")) {
      mimeType = "image/jpeg";
    } else if (image.startsWith("iVBOR")) {
      mimeType = "image/png";
    } else if (image.startsWith("UklGR")) {
      mimeType = "image/webp";
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { 
            role: "user", 
            content: [
              { type: "text", text: "Extraia os insumos e quantidades desta imagem de fórmula/suplemento:" },
              { 
                type: "image_url", 
                image_url: { 
                  url: `data:${mimeType};base64,${image}` 
                } 
              }
            ]
          }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Muitas requisições. Aguarde um momento e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Créditos insuficientes. Entre em contato com o suporte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao processar imagem com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response received");
    
    const texto = data.choices?.[0]?.message?.content || "";
    
    if (texto.startsWith("ERRO:")) {
      return new Response(
        JSON.stringify({ success: false, error: texto.replace("ERRO:", "").trim() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracted text:", texto.substring(0, 200) + "...");

    return new Response(
      JSON.stringify({ success: true, texto }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
