import { sendGenericEmail } from '../emailService';
import { renderAttendanceTemplate, type AttendanceNotificationTemplateKey } from './notificationTemplates';
import type { AttendanceNotificationChannelConfig } from '../../types/attendance';

export interface NotificationRecipient {
  email?: string;
  phone?: string;
  userId?: string;
  name?: string;
}

interface DispatchNotificationInput {
  template: AttendanceNotificationTemplateKey;
  channels: AttendanceNotificationChannelConfig;
  recipient: NotificationRecipient;
  payload: Record<string, unknown>;
}

const sendSmsMock = async (to: string, message: string): Promise<void> => {
  console.log(`[sms:mock] to=${to} message="${message}"`);
};

const sendPushMock = async (userId: string, message: string): Promise<void> => {
  console.log(`[push:mock] userId=${userId} message="${message}"`);
};

const sendInAppMock = async (userId: string, title: string, message: string): Promise<void> => {
  console.log(`[inapp:mock] userId=${userId} title="${title}" message="${message}"`);
};

export const dispatchAttendanceNotification = async (
  input: DispatchNotificationInput
): Promise<void> => {
  const rendered = renderAttendanceTemplate(input.template, input.payload);

  const tasks: Array<Promise<void>> = [];

  if (input.channels.email && input.recipient.email) {
    tasks.push(
      sendGenericEmail({
        to: input.recipient.email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html
      })
    );
  }

  if (input.channels.sms && input.recipient.phone) {
    tasks.push(sendSmsMock(input.recipient.phone, rendered.text));
  }

  if (input.channels.push && input.recipient.userId) {
    tasks.push(sendPushMock(input.recipient.userId, rendered.text));
  }

  if (input.channels.inApp && input.recipient.userId) {
    tasks.push(sendInAppMock(input.recipient.userId, rendered.subject, rendered.text));
  }

  if (tasks.length) {
    await Promise.all(tasks);
  }
};
