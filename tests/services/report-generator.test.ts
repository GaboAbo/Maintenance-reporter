import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-mock')),
  Document: ({ children }: any) => children,
  Page: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  View: ({ children }: any) => children,
  StyleSheet: { create: (styles: any) => styles },
}))

import { generateClientReportPdf } from '@/lib/services/report-generator'
import { renderToBuffer } from '@react-pdf/renderer'

const PARAMS = {
  tenantName: 'Acme Maintenance',
  client: { name: 'Hospital ABC', email: 'facilities@hospital.com' },
  periodStart: new Date('2026-04-14T00:00:00Z'),
  periodEnd: new Date('2026-04-20T23:59:59Z'),
  assets: [
    { name: 'Boiler 1', category: 'HVAC', location: 'Basement', status: 'ACTIVE' },
  ],
  workOrders: [
    { type: 'PREVENTIVE', status: 'COMPLETED', description: 'Monthly inspection', technicianName: 'John', completedAt: new Date('2026-04-18') },
  ],
}

beforeEach(() => vi.clearAllMocks())

describe('generateClientReportPdf', () => {
  it('returns a Buffer', async () => {
    const result = await generateClientReportPdf(PARAMS)
    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('calls renderToBuffer', async () => {
    await generateClientReportPdf(PARAMS)
    expect(renderToBuffer).toHaveBeenCalledOnce()
  })

  it('handles empty assets and work orders', async () => {
    const result = await generateClientReportPdf({ ...PARAMS, assets: [], workOrders: [] })
    expect(Buffer.isBuffer(result)).toBe(true)
  })
})
