import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Row {
  k: string
  v: string
}

interface Props {
  customerName?: string
  productName?: string
  submittedAt?: string
  rows?: Row[]
  downloadUrl?: string
}

const Email = ({
  customerName = '',
  productName = '',
  submittedAt = '',
  rows = [],
  downloadUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New quote — {customerName} ({productName})</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New quote request</Heading>
        <Text style={muted}>Submitted {submittedAt}</Text>
        {downloadUrl ? (
          <Text style={text}>
            <a href={downloadUrl} style={link}>Download quote PDF</a>
          </Text>
        ) : null}
        <table style={tableStyle}>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={tdLabel}>{r.k}</td>
                <td style={tdValue}>{r.v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `New quote — ${data.customerName ?? ''} (${data.productName ?? ''})`.trim(),
  displayName: 'Internal team quote notification',
  previewData: {
    customerName: 'Jane Smith',
    productName: 'Magma 001 Freestanding Fireplace 10kW',
    submittedAt: '12/06/2026 10:30 (SAST)',
    rows: [
      { k: 'Email', v: 'jane@example.com' },
      { k: 'Phone', v: '+27 82 555 1234' },
      { k: 'Quantity', v: '1' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#111' }
const container = { padding: '24px', maxWidth: '640px' }
const h1 = { fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }
const text = { fontSize: '14px', margin: '12px 0' }
const muted = { fontSize: '13px', color: '#555', margin: '0 0 16px' }
const link = { color: '#dd7400', fontWeight: 600 }
const tableStyle = { borderCollapse: 'collapse' as const, width: '100%', marginTop: '8px' }
const tdLabel = {
  padding: '6px 10px',
  border: '1px solid #eee',
  background: '#fafafa',
  fontWeight: 600,
  width: '180px',
  fontSize: '13px',
}
const tdValue = { padding: '6px 10px', border: '1px solid #eee', fontSize: '13px' }
