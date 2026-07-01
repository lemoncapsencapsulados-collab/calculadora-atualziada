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
  pdfUrl?: string
  orcamentoNumero?: string
}

const Email = ({ consultorNome, razaoSocial, cnpj, cliente, valorTotal, pdfUrl, orcamentoNumero }: Props) => {
  const identificacao = razaoSocial || cnpj || cliente || 'Produtor'
  const subtitulo = `${consultorNome || 'Consultor'} — ${identificacao}`
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Resumo Para Contrato Produtor Lemon Caps</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Resumo Para Contrato Produtor Lemon Caps</Heading>
          <Text style={sub}>{subtitulo}</Text>
          <Hr style={hr} />
          <Section>
            {orcamentoNumero && <Text style={row}><strong>Orçamento:</strong> {orcamentoNumero}</Text>}
            {cliente && <Text style={row}><strong>Cliente:</strong> {cliente}</Text>}
            {razaoSocial && <Text style={row}><strong>Razão Social:</strong> {razaoSocial}</Text>}
            {cnpj && <Text style={row}><strong>CNPJ:</strong> {cnpj}</Text>}
            {consultorNome && <Text style={row}><strong>Consultor:</strong> {consultorNome}</Text>}
            {valorTotal && <Text style={row}><strong>Valor Total:</strong> {valorTotal}</Text>}
          </Section>
          {pdfUrl && (
            <Section style={{ textAlign: 'center', marginTop: 24 }}>
              <Button href={pdfUrl} style={btn}>Baixar Projeto (PDF)</Button>
              <Text style={muted}>Link válido por 7 dias.</Text>
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
  to: 'financeiro@lemoncaps.com.br',
  previewData: {
    consultorNome: 'João da Silva',
    razaoSocial: 'Produtor Exemplo LTDA',
    cnpj: '00.000.000/0001-00',
    cliente: 'Cliente Exemplo',
    valorTotal: 'R$ 10.000,00',
    pdfUrl: 'https://example.com/projeto.pdf',
    orcamentoNumero: 'ORC-000',
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