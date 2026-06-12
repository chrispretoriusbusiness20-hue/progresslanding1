import type { ComponentType } from 'react'
import { template as quoteCustomer } from './quote-customer'
import { template as quoteTeam } from './quote-team'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'quote-customer': quoteCustomer,
  'quote-team': quoteTeam,
}
