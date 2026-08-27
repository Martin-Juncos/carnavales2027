import nodemailer, { type Transporter } from 'nodemailer'
import { logger } from '../../config/logger'
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
      throw new AppError('OTP_DELIVERY_UNAVAILABLE', 'El servicio de entrega del código no está disponible.', 503, undefined, true)
    }
    try {
      await this.transporter.sendMail({
        from: env.MAIL_FROM,
        to: recipient,
        subject: 'Código de acceso - Carnavales 2027',
        text: `Tu código de acceso es ${code}. No lo compartas.`,
      })
    } catch (error) {
      logger.error({ error }, 'OTP delivery failed')
      throw new AppError('OTP_DELIVERY_UNAVAILABLE', 'No se pudo enviar el código de acceso. Intentá nuevamente.', 503, undefined, true)
    }
  }
}
