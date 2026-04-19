export type NotificationEvent =
  | 'wo.assigned'
  | 'wo.status_changed'
  | 'wo.due_soon'
  | 'wo.overdue'
  | 'schedule.due_soon'
  | 'schedule.overdue'

export type NotificationPayload = {
  workOrderId?: string
  workOrderDescription?: string
  fromStatus?: string
  toStatus?: string
  dueDate?: string
  scheduleName?: string
}

type RenderedTemplate = {
  subject: string
  emailBody: string
  smsBody: string
}

export function renderTemplate(
  event: NotificationEvent,
  payload: NotificationPayload
): RenderedTemplate {
  switch (event) {
    case 'wo.assigned':
      return {
        subject: `Work order ${payload.workOrderId} assigned to you`,
        emailBody: `You have been assigned work order ${payload.workOrderId}${payload.workOrderDescription ? `: ${payload.workOrderDescription}` : ''}.`,
        smsBody: `MaintainIQ: WO ${payload.workOrderId} assigned to you.`,
      }
    case 'wo.status_changed':
      return {
        subject: `Work order ${payload.workOrderId} status updated`,
        emailBody: `Work order ${payload.workOrderId} status changed from ${payload.fromStatus} to ${payload.toStatus}.`,
        smsBody: `MaintainIQ: WO ${payload.workOrderId} is now ${payload.toStatus}.`,
      }
    case 'wo.due_soon':
      return {
        subject: `Work order ${payload.workOrderId} due soon`,
        emailBody: `Work order ${payload.workOrderId} is due within 24 hours (${payload.dueDate ? new Date(payload.dueDate).toLocaleDateString() : 'soon'}).`,
        smsBody: `MaintainIQ: WO ${payload.workOrderId} due within 24 hours.`,
      }
    case 'wo.overdue':
      return {
        subject: `Work order ${payload.workOrderId} is overdue`,
        emailBody: `Work order ${payload.workOrderId} is overdue (was due ${payload.dueDate ? new Date(payload.dueDate).toLocaleDateString() : 'recently'}).`,
        smsBody: `MaintainIQ: WO ${payload.workOrderId} is overdue.`,
      }
    case 'schedule.due_soon':
      return {
        subject: `Maintenance schedule "${payload.scheduleName}" due soon`,
        emailBody: `The maintenance schedule "${payload.scheduleName}" is due within 24 hours (${payload.dueDate ? new Date(payload.dueDate).toLocaleDateString() : 'soon'}).`,
        smsBody: `MaintainIQ: Schedule "${payload.scheduleName}" due within 24 hours.`,
      }
    case 'schedule.overdue':
      return {
        subject: `Maintenance schedule "${payload.scheduleName}" is overdue`,
        emailBody: `The maintenance schedule "${payload.scheduleName}" is overdue (was due ${payload.dueDate ? new Date(payload.dueDate).toLocaleDateString() : 'recently'}).`,
        smsBody: `MaintainIQ: Schedule "${payload.scheduleName}" is overdue.`,
      }
  }
}
