import React from 'react'
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  quoteNo?: string
  productName?: string
  productImage?: string
  downloadUrl?: string
  expiresInDays?: number
}

const Email = ({
  clientName = 'there',
  quoteNo = '',
  productName = 'your selection',
  productImage = '',
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
        {productImage ? (
          <Section style={productCard}>
            <Row>
              <Column style={{ width: '136px', verticalAlign: 'middle' }}>
                <Img src={productImage} alt={productName} width="120" height="120" style={productImg} />
              </Column>
              <Column style={{ verticalAlign: 'middle' }}>
                <Text style={productLabel}>{productName}</Text>
              </Column>
            </Row>
          </Section>
        ) : null}
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={downloadUrl} style={button}>
            Download your quote (PDF)
          </Button>
        </Section>
        <Hr style={hr} />
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
    productImage: 'https://progressgroup.co.za/wp-content/uploads/2023/06/Single-Wall-Flue-Pipe-300x300.jpg',
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
const productCard = { margin: '16px 0', padding: '12px', border: '1px solid #eee', borderRadius: '6px' }
const productImg = { display: 'block', border: '1px solid #eee', borderRadius: '6px', objectFit: 'cover' as const }
const productLabel = { fontSize: '14px', lineHeight: '1.5', margin: 0, fontWeight: 600, color: '#111' }

