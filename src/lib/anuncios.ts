export const CANAIS_VENDAS = [
  { id: 'meta_ads_whatsapp', label: 'Meta Ads → WhatsApp' },
] as const;

export const OBJETIVOS_CAMPANHA = [
  { id: 'mensagem_consultor', label: 'Mensagem para Consultor (WhatsApp)' },
  { id: 'direct_instagram', label: 'Mensagem no Direct do Instagram' },
  { id: 'view_video', label: 'Visualização de Vídeo' },
  { id: 'engajamento_video', label: 'Engajamento com Vídeo' },
  { id: 'visitas_perfil', label: 'Visitas ao Perfil' },
  { id: 'novos_seguidores', label: 'Novos Seguidores' },
] as const;

export function labelCanal(id: string): string {
  return CANAIS_VENDAS.find((c) => c.id === id)?.label || id;
}

export function labelObjetivo(id: string): string {
  return OBJETIVOS_CAMPANHA.find((o) => o.id === id)?.label || id;
}

export function calcularCPL(investimento: number, leads: number): number {
  return leads > 0 ? investimento / leads : 0;
}

export function formatBRL(v: number): string {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function diasEntre(inicio: string, fim: string): number {
  const a = new Date(inicio + 'T00:00:00');
  const b = new Date(fim + 'T00:00:00');
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

export const MODELOS_AQUISICAO = [
  { id: 'indicacao', label: 'Indicação' },
  { id: 'trafego_whatsapp', label: 'Tráfego no WhatsApp' },
  { id: 'funil_formulario', label: 'Funil de formulário' },
  { id: 'pagina_vendas', label: 'Página de vendas' },
] as const;

export const MODELOS_AQUISICAO_ANUNCIO = ['trafego_whatsapp', 'funil_formulario', 'pagina_vendas'];

export function labelModeloAquisicao(id: string | null | undefined): string {
  if (!id) return 'Não informado';
  return MODELOS_AQUISICAO.find((m) => m.id === id)?.label || id;
}
