import nodemailer, { type Transporter } from 'nodemailer'
import { AppError } from '../../shared/errors/app-error'
import { env } from '../../config/env'

export interface OtpDelivery {
  send(recipient: string, code: string): Promise<void>
}

export class SmtpOtpDelivery implements OtpDelivery {
  private readonly transporter: Transporter | undefined

  constructor() {
    if (!env.SMTP_HOST) return
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER && env.SMTP_PASSWORD
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
        : {}),
    })
  }

  async send(recipient: string, code: string): Promise<void> {
    if (!this.transporter) {
      throw new AppError('INTERNAL_ERROR', 'El canal OTP no está configurado.', 503, undefined, true)
    }
    await this.transporter.sendMail({
      from: env.MAIL_FROM,
      to: recipient,
      subject: 'Código de acceso - Carnavales 2027',
      text: `Tu código de acceso es ${code}. No lo compartas.`,
    })
  }
}
