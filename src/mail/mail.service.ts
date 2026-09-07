import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AccessGrantDeliverable {
  to: string;
  fullName: string;
  password: string;
  expiresAt?: Date;
}

export interface LeadNotification {
  lead: { name?: string; email?: string; phone?: string; message?: string };
}

export interface CustomEmail {
  to: string;
  subject: string;
  body: string;
}

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');
  private readonly apiKey: string | undefined;
  private readonly fromEmail: string | undefined;
  private readonly fromName: string | undefined;
  private readonly appUrl: string | undefined;
  private readonly ownerEmail: string | undefined;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('mail.apiKey');
    this.fromEmail = config.get<string>('mail.fromEmail');
    this.fromName = config.get<string>('mail.fromName') ?? 'Marca Personal';
    this.appUrl = config.get<string>('mail.appUrl');
    this.ownerEmail = config.get<string>('mail.ownerEmail') ?? this.fromEmail;
  }

  async sendAccessGranted(payload: AccessGrantDeliverable): Promise<void> {
    const expiry = payload.expiresAt
      ? `Tu acceso vence el ${payload.expiresAt.toISOString()}.`
      : 'Tu acceso no tiene fecha de vencimiento.';
    const loginUrl = this.appUrl ? `${this.appUrl}/login` : 'la plataforma';

    await this.send(
      payload.to,
      payload.fullName,
      'Tus credenciales de acceso',
      [
        `Hola ${payload.fullName},`,
        'Te compartimos tus credenciales de acceso:',
        `Correo: ${payload.to}`,
        `Contraseña: ${payload.password}`,
        expiry,
        `Inicia sesión en ${loginUrl}`,
      ],
    );
  }

  async sendLeadNotification(payload: LeadNotification): Promise<void> {
    if (!this.ownerEmail) return;
    const lines = [
      'Nuevo contacto recibido:',
      `Nombre: ${payload.lead.name ?? '-'}`,
      `Correo: ${payload.lead.email ?? '-'}`,
      `Teléfono: ${payload.lead.phone ?? '-'}`,
      `Mensaje: ${payload.lead.message ?? '-'}`,
    ];

    await this.send(this.ownerEmail, 'Gary Mayhua', 'Nuevo contacto en la web', lines);
  }

  async sendCustomEmail(payload: CustomEmail): Promise<void> {
    await this.send(payload.to, payload.to, payload.subject, payload.body.split('\n'));
  }

  private async send(to: string, toName: string, subject: string, bodyLines: string[]): Promise<void> {
    if (!this.apiKey || !this.fromEmail) {
      this.logger.warn('Mail no configurado, no se envió el correo');
      return;
    }

    const html = bodyLines.map((line) => this.escape(line)).join('<br/>');
    const text = bodyLines.join('\n');

    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.fromEmail, name: this.fromName },
        to: [{ email: to, name: toName }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    if (!response.ok) {
      this.logger.error(`Brevo respondió ${response.status}: ${await response.text()}`);
    }
  }

  private escape(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}