import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  quoteNo?: string
  productName?: string
  downloadUrl?: string
  expiresInDays?: number
}

const Email = ({
  clientName = 'there',
  quoteNo = '',
  productName = 'your selection',
  downloadUrl = '#',
  expiresInDays = 10,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{quoteNo ? quoteNo : 'Your quote'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{quoteNo ? quoteNo : 'Your quote'}</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          Thanks for your interest in <strong>{productName}</strong>. Herewith your quote as requested.
        </Text>
        <Text style={notice}>
          <strong>Payment terms:</strong> 100% deposit is required for ACCEPTANCE OF QUOTATION. Balance is payable on completion.
        </Text>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={downloadUrl} style={button}>
            Download your quote (PDF)
          </Button>
        </Section>
        <Text style={muted}>
          This link is valid for {expiresInDays} days. If the button doesn't work,
          copy and paste this URL into your browser:
        </Text>
        <Text style={linkText}>{downloadUrl}</Text>
        <Hr style={hr} />
        <Text style={muted}>
          Questions? Reply to this email or call us — we're happy to help.
        </Text>
        <Text style={muted}>— Progress Installations</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    data.quoteNo ? `${data.quoteNo}` : `Your quote`,
  displayName: 'Customer quote (with PDF link)',
  previewData: {
    clientName: 'Jane Smith',
    quoteNo: 'JS1806 - 001',
    productName: 'Magma 001 Freestanding Fireplace 10kW',
    downloadUrl: 'https://example.com/download.pdf',
    expiresInDays: 10,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#111' }
const container = { padding: '24px', maxWidth: '640px' }
const h1 = { fontSize: '22px', fontWeight: 700, margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '1.6', margin: '0 0 12px' }
const notice = { fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px', padding: '12px 16px', backgroundColor: '#fff7ed', borderLeft: '4px solid #dd7400', color: '#7c2d12' }
const muted = { fontSize: '13px', lineHeight: '1.6', color: '#555', margin: '0 0 8px' }
const linkText = { fontSize: '12px', wordBreak: 'break-all' as const, color: '#0a58ca', margin: '0 0 16px' }
const button = {
  backgroundColor: '#dd7400',
  color: '#ffffff',
  padding: '12px 22px',
  borderRadius: '4px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#eee', margin: '24px 0' }
