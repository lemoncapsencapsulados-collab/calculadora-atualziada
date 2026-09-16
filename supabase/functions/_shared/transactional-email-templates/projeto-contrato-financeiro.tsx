import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  consultorNome?: string
  razaoSocial?: string
  cnpj?: string
  cliente?: string
  valorTotal?: string
  documentoUrl?: string
  pdfUrl?: string
  orcamentoNumero?: string
  modeloNome?: string
}

const Email = ({ consultorNome, razaoSocial, cnpj, cliente, valorTotal, documentoUrl, pdfUrl, orcamentoNumero, modeloNome }: Props) => {
  const linkContrato = documentoUrl || pdfUrl
  const identificacao = razaoSocial || cnpj || cliente || 'Produtor'
  const subtitulo = `${consultorNome || 'Consultor'} — ${identificacao}`
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Contrato DOCX pronto para conferência do financeiro</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Contrato para conferência do financeiro</Heading>
          <Text style={sub}>{subtitulo}</Text>
          <Hr style={hr} />
          <Section>
            {orcamentoNumero && <Text style={row}><strong>Orçamento:</strong> {orcamentoNumero}</Text>}
            {modeloNome && <Text style={row}><strong>Modelo:</strong> {modeloNome}</Text>}
            {cliente && <Text style={row}><strong>Cliente:</strong> {cliente}</Text>}
            {razaoSocial && <Text style={row}><strong>Razão Social:</strong> {razaoSocial}</Text>}
            {cnpj && <Text style={row}><strong>CNPJ:</strong> {cnpj}</Text>}
            {consultorNome && <Text style={row}><strong>Consultor:</strong> {consultorNome}</Text>}
            {valorTotal && <Text style={row}><strong>Valor Total:</strong> {valorTotal}</Text>}
          </Section>
          {linkContrato && (
            <Section style={{ textAlign: 'center', marginTop: 24 }}>
              <Button href={linkContrato} style={btn}>Baixar contrato DOCX</Button>
              <Text style={muted}>Link válido por 14 dias.</Text>
            </Section>
          )}
          <Hr style={hr} />
          <Text style={muted}>Este e-mail foi enviado automaticamente pela Calculadora Lemon Caps.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Resumo Para Contrato Produtor Lemon Caps',
  displayName: 'Projeto para Contrato — Financeiro',
  previewData: {
    consultorNome: 'João da Silva',
    razaoSocial: 'Produtor Exemplo LTDA',
    cnpj: '00.000.000/0001-00',
    cliente: 'Cliente Exemplo',
    valorTotal: 'R$ 10.000,00',
    documentoUrl: 'https://example.com/contrato.docx',
    orcamentoNumero: 'ORC-000',
    modeloNome: 'Contrato padrão',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const h1 = { color: '#166534', fontSize: '20px', margin: '0 0 8px' }
const sub = { color: '#374151', fontSize: '14px', margin: '0 0 16px' }
const row = { fontSize: '14px', color: '#111827', margin: '4px 0' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const btn = { backgroundColor: '#16a34a', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }
const muted = { color: '#6b7280', fontSize: '12px', marginTop: '8px' }