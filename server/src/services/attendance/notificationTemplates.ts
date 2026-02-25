export type AttendanceNotificationTemplateKey =
  | 'invalid_punch'
  | 'late_arrival'
  | 'absent'
  | 'punch_reminder'
  | 'approval_pending'
  | 'approval_decision'
  | 'bulk_sync_completed';

export interface TemplatePayload {
  employeeName?: string;
  managerName?: string;
  organizationName?: string;
  date?: string;
  time?: string;
  status?: string;
  reason?: string;
  actionBy?: string;
  count?: number;
}

export interface RenderedTemplate {
  subject: string;
  text: string;
  html: string;
}

const value = (input: unknown, fallback: unknown = ''): string => {
  if (input === undefined || input === null) {
    return String(fallback ?? '');
  }

  return String(input);
};

export const renderAttendanceTemplate = (
  key: AttendanceNotificationTemplateKey,
  payload: TemplatePayload
): RenderedTemplate => {
  switch (key) {
    case 'invalid_punch': {
      const subject = `Invalid attendance punch detected - ${value(payload.organizationName, 'HRMS')}`;
      const text = [
        `Hi ${value(payload.employeeName, 'Employee')},`,
        '',
        `Your punch on ${value(payload.date)} ${value(payload.time)} was marked ${value(payload.status)}.`,
        `Reason: ${value(payload.reason, 'Validation policy mismatch')}`,
        '',
        'Please submit regularization if required.'
      ].join('\n');
      return {
        subject,
        text,
        html: `<p>${text.replace(/\n/g, '<br/>')}</p>`
      };
    }

    case 'late_arrival': {
      const subject = `Late arrival alert - ${value(payload.employeeName)}`;
      const text = [
        `Hi ${value(payload.managerName, 'Manager')},`,
        '',
        `${value(payload.employeeName, 'An employee')} is marked late on ${value(payload.date)} at ${value(payload.time)}.`,
        `Reason: ${value(payload.reason, 'Late check-in')}`
      ].join('\n');

      return {
        subject,
        text,
        html: `<p>${text.replace(/\n/g, '<br/>')}</p>`
      };
    }

    case 'absent': {
      const subject = `Absence alert - ${value(payload.employeeName)}`;
      const text = [
        `Attendance system marked ${value(payload.employeeName, 'employee')} absent on ${value(payload.date)}.`,
        `Reason: ${value(payload.reason, 'No valid check-in')}`
      ].join('\n');
      return { subject, text, html: `<p>${text.replace(/\n/g, '<br/>')}</p>` };
    }

    case 'punch_reminder': {
      const subject = 'Attendance reminder';
      const text = [
        `Hi ${value(payload.employeeName, 'Employee')},`,
        '',
        'Please complete your attendance punch for today.'
      ].join('\n');

      return { subject, text, html: `<p>${text.replace(/\n/g, '<br/>')}</p>` };
    }

    case 'approval_pending': {
      const subject = 'Attendance approval pending';
      const text = [
        `Hi ${value(payload.managerName, 'Approver')},`,
        '',
        `You have pending attendance punch approvals (${value(payload.count, 1)}).`
      ].join('\n');

      return { subject, text, html: `<p>${text.replace(/\n/g, '<br/>')}</p>` };
    }

    case 'approval_decision': {
      const subject = `Attendance ${value(payload.status, 'decision')} update`;
      const text = [
        `Hi ${value(payload.employeeName, 'Employee')},`,
        '',
        `Your request was ${value(payload.status)} by ${value(payload.actionBy, 'approver')}.`,
        `Reason: ${value(payload.reason, 'N/A')}`
      ].join('\n');

      return { subject, text, html: `<p>${text.replace(/\n/g, '<br/>')}</p>` };
    }

    case 'bulk_sync_completed': {
      const subject = 'Attendance bulk sync completed';
      const text = [
        `Bulk sync completed successfully.`,
        `Records processed: ${value(payload.count, 0)}`
      ].join('\n');

      return { subject, text, html: `<p>${text.replace(/\n/g, '<br/>')}</p>` };
    }

    default:
      return {
        subject: 'Attendance notification',
        text: 'Attendance event received',
        html: '<p>Attendance event received</p>'
      };
  }
};
