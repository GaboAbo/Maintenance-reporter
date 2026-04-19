import { describe, it, expect } from 'vitest'
import { renderTemplate } from '@/lib/notifications/templates'

describe('renderTemplate', () => {
  it('renders wo.assigned', () => {
    const t = renderTemplate('wo.assigned', { workOrderId: 'WO-1', workOrderDescription: 'Fix HVAC' })
    expect(t.subject).toContain('WO-1')
    expect(t.emailBody).toContain('WO-1')
    expect(t.emailBody).toContain('Fix HVAC')
    expect(t.smsBody).toBeTruthy()
    expect(t.smsBody).toContain('WO-1')
  })

  it('renders wo.assigned without description', () => {
    const t = renderTemplate('wo.assigned', { workOrderId: 'WO-1' })
    expect(t.subject).toContain('WO-1')
    expect(t.emailBody).toContain('WO-1')
    expect(t.emailBody).not.toContain(': ')
    expect(t.smsBody).toBeTruthy()
  })

  it('renders wo.status_changed', () => {
    const t = renderTemplate('wo.status_changed', {
      workOrderId: 'WO-2',
      fromStatus: 'OPEN',
      toStatus: 'IN_PROGRESS',
    })
    expect(t.subject).toContain('WO-2')
    expect(t.emailBody).toContain('OPEN')
    expect(t.emailBody).toContain('IN_PROGRESS')
    expect(t.smsBody).toBeTruthy()
    expect(t.smsBody).toContain('WO-2')
  })

  it('renders wo.due_soon', () => {
    const t = renderTemplate('wo.due_soon', {
      workOrderId: 'WO-3',
      dueDate: '2026-04-20T06:00:00.000Z',
    })
    expect(t.subject).toContain('WO-3')
    expect(t.emailBody).toContain('WO-3')
    expect(t.smsBody).toBeTruthy()
    expect(t.smsBody).toContain('WO-3')
  })

  it('renders wo.overdue', () => {
    const t = renderTemplate('wo.overdue', {
      workOrderId: 'WO-4',
      dueDate: '2026-04-18T06:00:00.000Z',
    })
    expect(t.subject).toContain('WO-4')
    expect(t.emailBody).toContain('WO-4')
    expect(t.smsBody).toBeTruthy()
    expect(t.smsBody).toContain('WO-4')
  })

  it('renders schedule.due_soon', () => {
    const t = renderTemplate('schedule.due_soon', {
      scheduleName: 'Monthly HVAC',
      dueDate: '2026-04-20T06:00:00.000Z',
    })
    expect(t.subject).toContain('Monthly HVAC')
    expect(t.emailBody).toContain('Monthly HVAC')
    expect(t.smsBody).toBeTruthy()
    expect(t.smsBody).toContain('Monthly HVAC')
  })

  it('renders schedule.overdue', () => {
    const t = renderTemplate('schedule.overdue', {
      scheduleName: 'Quarterly Pump Check',
      dueDate: '2026-04-17T06:00:00.000Z',
    })
    expect(t.subject).toContain('Quarterly Pump Check')
    expect(t.emailBody).toContain('Quarterly Pump Check')
    expect(t.smsBody).toBeTruthy()
    expect(t.smsBody).toContain('Quarterly Pump Check')
  })
})
