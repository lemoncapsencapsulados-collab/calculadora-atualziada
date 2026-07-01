import { template as projetoContrato } from './projeto-contrato-financeiro.tsx'

export interface TemplateEntry {
  component: (props: any) => any
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'projeto-contrato-financeiro': projetoContrato,
}