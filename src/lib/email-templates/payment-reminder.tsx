import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  productName?: string
  totalLabel?: string
}

const Email = ({ clientName = 'there', productName = 'your selection', totalLabel = '' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your order is still waiting for you</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your order is still waiting</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          You recently started checkout for <strong>{productName}</strong>
          {totalLabel ? <> ({totalLabel})</> : null}, but the payment wasn't completed.
        </Text>
        <Text style={text}>
          If something went wrong, or you'd prefer to pay by EFT, simply reply to this email or call us and
          we'll help you finish your order. We're also happy to answer any questions about installation or delivery.
        </Text>
        <Hr style={hr} />
        <Text style={muted}>Kind regards,<br />The Progress Group sales team<br />sales@progressgrp.co.za</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Need a hand finishing your order?',
  displayName: 'Unfinished payment reminder',
  previewData: { clientName: 'Paul', productName: 'Magma 001 Special', totalLabel: 'R23 970,00' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#111' }
const container = { padding: '24px', maxWidth: '640px' }
const h1 = { fontSize: '22px', fontWeight: 700, margin: '0 0 16px', color: '#8a6d00' }
const text = { fontSize: '15px', lineHeight: '1.6', margin: '0 0 12px' }
const muted = { fontSize: '13px', lineHeight: '1.6', color: '#555', margin: '0 0 8px' }
const hr = { borderColor: '#eee', margin: '24px 0' }
