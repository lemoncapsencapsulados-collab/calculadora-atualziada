// Lê a fórmula de uma foto (rótulo, receita, print de planilha) e devolve os
// insumos já separados em nome / quantidade / unidade.
//
// Antes isto passava pelo gateway da Lovable e devolvia TEXTO, que o front
// quebrava de novo com expressão regular. Duas leituras do mesmo dado, e a
// segunda errava em nome com número dentro ("Ômega 3", "Coenzima Q10"). Agora a
// separação é feita uma vez só, por quem já está olhando a imagem, e chega
// pronta — o front só confere.
//
// Nada aqui decide nada sozinho: a tela de conferência exige olho humano em
// cada linha antes de importar.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { ErroIA, gerarJson } from '../_shared/anthropic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** As mesmas unidades que a calculadora aceita; qualquer outra não teria onde entrar. */
const UNIDADES = ['mcg', 'mg', 'g', 'kg', 'mL', 'L', 'UI', 'unidade'] as const;

const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Teto da API da Anthropic por imagem, em bytes de base64. */
const MAX_BASE64 = 5 * 1024 * 1024;

const SYSTEM = `Você lê fórmulas de suplementos em imagens (rótulos, tabelas nutricionais, receitas de manipulação, prints de planilha) e extrai a lista de matérias-primas.

Para cada ingrediente devolva:
- nome: o nome da matéria-prima como está escrito na imagem, completo, incluindo forma química e o que estiver entre parênteses (ex.: "Zinco bisglicinato", "Vitamina D3 (colecalciferol)"). Não traduza, não abrevie, não corrija.
- quantidade: só o número, por dose. Use ponto como separador decimal.
- unidade: uma de ${UNIDADES.join(', ')}.

REGRAS:
- Extraia TODOS os ingredientes que tiverem quantidade, na ordem em que aparecem.
- Se a imagem der a quantidade por porção de várias cápsulas, devolva o valor como está escrito e registre o aviso em "observacao".
- Ignore excipientes sem quantidade, valores diários (%VD), texto de marketing e dados de contato.
- Não invente ingrediente que não esteja na imagem, e não complete quantidade que você não conseguiu ler: nesse caso use 0 e diga em "observacao" quais linhas ficaram ilegíveis.
- "unidade" fora da lista não existe: converta UI para UI, mcg/µg para mcg, ml para mL.
- Se não houver nenhuma fórmula legível, devolva itens vazio e explique em "observacao".`;

const SCHEMA = {
  type: 'object',
  properties: {
    itens: {
      type: 'array',
      description: 'Matérias-primas encontradas, na ordem da imagem.',
      items: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome como está escrito na imagem.' },
          quantidade: { type: 'number', description: 'Quantidade por dose; 0 se ilegível.' },
          unidade: { type: 'string', enum: UNIDADES as unknown as string[] },
        },
      },
    },
    observacao: {
      type: 'string',
      description: 'O que ficou duvidoso na leitura. Vazio quando não há ressalva.',
    },
  },
};

interface Extracao {
  itens: { nome: string; quantidade: number; unidade: string }[];
  observacao: string;
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** O front manda o mime; a assinatura do base64 é a conferência. */
function mimeDaImagem(base64: string, informado?: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  return informado && MIMES.includes(informado) ? informado : 'image/jpeg';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Não autorizado' }, 401);
    }
    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: claims, error: erroClaims } = await anon.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    // Só JWT de usuário logado. A chave publicável também é um JWT válido e
    // está no bundle que qualquer um baixa: aceitar "token válido" deixaria
    // esta função aberta para estranhos gastarem crédito de IA.
    const papel = (claims?.claims as { role?: string; sub?: string } | undefined);
    if (erroClaims || papel?.role !== 'authenticated' || !papel?.sub) {
      return json({ success: false, error: 'Não autorizado' }, 401);
    }

    const { image, mime } = await req.json();
    if (typeof image !== 'string' || !image) {
      return json({ success: false, error: 'Nenhuma imagem recebida' }, 400);
    }
    if (image.length > MAX_BASE64) {
      return json(
        { success: false, error: 'Imagem grande demais. Tire a foto mais de perto ou reduza o arquivo.' },
        413,
      );
    }

    const { dados, uso } = await gerarJson<Extracao>({
      system: SYSTEM,
      partes: [
        { imagem: { base64: image, midia: mimeDaImagem(image, mime) } },
        { text: 'Extraia as matérias-primas e as quantidades por dose desta fórmula.' },
      ],
      schema: SCHEMA,
      // Ler rótulo torto, escrito à mão ou fotografado de lado pede mais
      // raciocínio do que classificar conversa — aqui errar custa fórmula errada.
      esforco: 'high',
      maxTokens: 4000,
    });

    // Filtra o que não tem como virar linha da calculadora, mas mantém o que a
    // IA marcou como ilegível (quantidade 0): quem confere precisa VER a linha
    // faltando, não descobrir depois que ela sumiu.
    const itens = (dados.itens || [])
      .filter((i) => i && typeof i.nome === 'string' && i.nome.trim())
      .map((i) => ({
        nome: i.nome.trim(),
        quantidade: Number.isFinite(i.quantidade) ? i.quantidade : 0,
        unidade: UNIDADES.includes(i.unidade as typeof UNIDADES[number]) ? i.unidade : 'mg',
      }));

    console.log(
      `extracao: ${itens.length} itens, tokens ${uso.entrada}/${uso.saida}` +
        (dados.observacao ? ` | ${dados.observacao}` : ''),
    );

    return json({
      success: true,
      itens,
      observacao: dados.observacao || '',
      // Texto para o caso de alguém querer conferir a leitura crua.
      texto: itens.map((i) => `${i.nome} ${i.quantidade}${i.unidade}`).join('\n'),
    });
  } catch (e) {
    if (e instanceof ErroIA) {
      console.error('erro da IA:', e.message);
      const mensagem =
        e.status === 429
          ? 'Muitas leituras ao mesmo tempo. Espere alguns segundos e tente de novo.'
          : e.status === 401
            ? 'Chave da IA inválida ou sem crédito. Avise o administrador.'
            : `Não foi possível ler a imagem: ${e.message}`;
      return json({ success: false, error: mensagem }, e.status >= 400 ? e.status : 500);
    }
    console.error('erro inesperado:', e);
    return json(
      { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido' },
      500,
    );
  }
});
