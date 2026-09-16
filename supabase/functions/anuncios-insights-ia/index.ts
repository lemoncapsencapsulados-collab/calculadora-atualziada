import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return json({ error: 'LOVABLE_API_KEY ausente' }, 500);

  try {
    const body = await req.json();
    const { periodo, kpis, anterior, consultores, completa } = body || {};

    if (!kpis || (Number(kpis.leads) || 0) < 10) {
      return json({ insuficiente: true, texto: 'Dados insuficientes para análise.' });
    }

    const contexto = {
      periodo,
      kpis,
      periodo_anterior: anterior,
      consultores,
    };

    const prompt = completa
      ? 'Faça uma análise completa e aprofundada do desempenho de tráfego pago, com diagnóstico por consultor, gargalos do funil, comparação com o período anterior e um plano de ação priorizado com 4 a 6 recomendações concretas.'
      : 'Faça uma análise executiva curta (máximo 3 parágrafos curtos) do desempenho de tráfego pago do período. Destaque a variação de CPL/CAC, quem lidera em volume, quem tem melhor taxa de conversão e um alerta objetivo sobre o pior gargalo.';

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'Você é um analista de performance de mídia paga de uma indústria de suplementos brasileira. Responda em português do Brasil, direto ao ponto, com números reais dos dados fornecidos. Sem emojis. Sem markdown de título. Use parágrafos curtos e, quando fizer sentido, listas simples com hífen.',
          },
          { role: 'user', content: `${prompt}\n\nDados do período (JSON):\n${JSON.stringify(contexto)}` },
        ],
      }),
    });

    if (!res.ok) {
      const detalhe = await res.text();
      console.error(`AI gateway falhou [${res.status}]: ${detalhe}`);
      if (res.status === 429) return json({ error: 'Limite de requisições atingido. Tente novamente em instantes.' }, 429);
      if (res.status === 402) return json({ error: 'Créditos de IA esgotados.' }, 402);
      return json({ error: 'Falha ao gerar análise', detalhe }, res.status);
    }

    const data = await res.json();
    const texto = data?.choices?.[0]?.message?.content || '';
    return json({ texto });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
