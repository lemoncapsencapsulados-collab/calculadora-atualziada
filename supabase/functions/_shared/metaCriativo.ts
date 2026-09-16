// Extração e versionamento de criativo.
//
// O ponto todo desta camada é responder "qual copy estava no ar em 12/08". Sem
// isso, comparar desempenho entre textos mistura duas versões no mesmo período
// e a conclusão sobre qual funciona fica sem sentido.
//
// O mecanismo é um hash do conteúdo: se mudou, abre versão nova e fecha a
// anterior; se não mudou, só estende a vigência.

export interface CriativoExtraido {
  ad_id: string;
  ad_name: string | null;
  titulo: string | null;
  corpo: string | null;
  descricao: string | null;
  cta: string | null;
  url_destino: string | null;
  image_url: string | null;
  video_id: string | null;
  object_story_spec: unknown;
}

function txt(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
}

export function extrairCriativo(ad: any): CriativoExtraido {
  const c = ad?.creative ?? {};
  const link = c?.object_story_spec?.link_data ?? {};
  const video = c?.object_story_spec?.video_data ?? {};

  return {
    ad_id: String(ad?.id ?? ''),
    ad_name: txt(ad?.name),
    titulo: txt(c?.title) ?? txt(link?.name),
    // A Meta põe o texto ora em `body`, ora dentro do story spec, dependendo do
    // formato do anúncio.
    corpo: txt(c?.body) ?? txt(link?.message) ?? txt(video?.message),
    descricao: txt(link?.description),
    cta: txt(c?.call_to_action_type) ?? txt(link?.call_to_action?.type),
    url_destino: txt(link?.link) ?? txt(c?.link_url),
    image_url: txt(c?.image_url) ?? txt(link?.picture),
    video_id: txt(c?.video_id) ?? txt(video?.video_id),
    object_story_spec: c?.object_story_spec ?? null,
  };
}

/**
 * Digest do que constitui o criativo. O nome do anúncio fica de fora de
 * propósito: renomear é organização, não troca de criativo, e se entrasse aqui
 * cada renomeação abriria uma versão falsa.
 *
 * `crypto.subtle` existe tanto no Deno quanto no Node 18+, então o mesmo código
 * roda na edge function e no teste.
 */
export async function hashCriativo(c: CriativoExtraido): Promise<string> {
  const material = JSON.stringify([
    c.titulo,
    c.corpo,
    c.descricao,
    c.cta,
    c.url_destino,
    c.image_url,
    c.video_id,
  ]);
  const bytes = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function decidirVersao(
  vigente: { hash_conteudo: string } | null,
  hashNovo: string
): 'manter' | 'abrir' {
  if (!vigente) return 'abrir';
  return vigente.hash_conteudo === hashNovo ? 'manter' : 'abrir';
}
