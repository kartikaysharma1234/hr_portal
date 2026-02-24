import nodemailer from 'nodemailer';

import { env } from '../config/env';

const transporter = env.smtpHost
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined
    })
  : null;

const deliverEmail = async (params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> => {
  if (!transporter) {
    console.log(`[email:mock] to=${params.to} subject="${params.subject}"`);
    console.log(params.text);
    return;
  }

  await transporter.sendMail({
    from: env.smtpFrom,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html
  });
};

export const sendEmailVerification = async (params: {
  to: string;
  name: string;
  verificationUrl: string;
  organizationName: string;
}): Promise<void> => {
  const subject = `Verify your email for ${params.organizationName} HRMS`;
  const text = [
    `Hi ${params.name},`,
    '',
    'Please verify your email address to activate your account.',
    `Verification link: ${params.verificationUrl}`,
    '',
    'If you did not create this account, you can ignore this email.'
  ].join('\n');

  const html = `
    <p>Hi ${params.name},</p>
    <p>Please verify your email address to activate your account.</p>
    <p><a href="${params.verificationUrl}">Verify Email</a></p>
    <p>If you did not create this account, you can ignore this email.</p>
  `;

  await deliverEmail({
    to: params.to,
    subject,
    text,
    html
  });
};

export const sendPasswordResetEmail = async (params: {
  to: string;
  name: string;
  resetUrl: string;
  organizationName: string;
}): Promise<void> => {
  const subject = `Reset your ${params.organizationName} HRMS password`;
  const text = [
    `Hi ${params.name},`,
    '',
    'We received a request to reset your password.',
    `Reset link: ${params.resetUrl}`,
    '',
    'If this was not you, please ignore this email.'
  ].join('\n');

  const html = `
    <p>Hi ${params.name},</p>
    <p>We received a request to reset your password.</p>
    <p><a href="${params.resetUrl}">Reset Password</a></p>
    <p>If this was not you, please ignore this email.</p>
  `;

  await deliverEmail({
    to: params.to,
    subject,
    text,
    html
  });
};
