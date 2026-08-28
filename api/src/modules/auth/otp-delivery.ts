import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import nodemailer, { type Transporter } from 'nodemailer'
import { Resend } from 'resend'
import { logger } from '../../config/logger'
import { AppError } from '../../shared/errors/app-error'
import { env } from '../../config/env'

export interface OtpDelivery {
  send(recipient: string, code: string): Promise<void>
}

export class SmtpOtpDelivery implements OtpDelivery {
  private readonly transporter: Transporter | undefined
  private readonly resend: Resend | undefined

  constructor() {
    this.resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : undefined
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
    if (env.NODE_ENV === 'development' && env.OTP_DEV_LOG) {
      logger.warn({ recipient, code }, 'OTP_DEV_LOG enabled: development OTP code')
      const otpPath = path.resolve('storage', 'dev-otp.txt')
      await mkdir(path.dirname(otpPath), { recursive: true })
      await writeFile(otpPath, `email=${recipient}\ncode=${code}\ncreatedAt=${new Date().toISOString()}\n`, 'utf8')
      console.warn([
        '',
        '==================================================',
        ` OTP DEV CODE (${recipient}): ${code}`,
        ` OTP DEV FILE: ${otpPath}`,
        '==================================================',
        '',
      ].join('\n'))
      return
    }

    if (this.resend) {
      await this.sendWithResend(recipient, code)
      return
    }

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

  private async sendWithResend(recipient: string, code: string): Promise<void> {
    if (!this.resend) return
    try {
      const { error } = await this.resend.emails.send({
        from: env.MAIL_FROM,
        to: [recipient],
        subject: 'Código de acceso - Carnavales 2027',
        text: `Tu código de acceso es ${code}. No lo compartas.`,
      })
      if (error) {
        logger.error({ error }, 'Resend OTP delivery failed')
        throw new AppError('OTP_DELIVERY_UNAVAILABLE', 'No se pudo enviar el código de acceso. Intentá nuevamente.', 503, undefined, true)
      }
    } catch (error) {
      if (error instanceof AppError) throw error
      logger.error({ error }, 'Resend OTP delivery failed')
      throw new AppError('OTP_DELIVERY_UNAVAILABLE', 'No se pudo enviar el código de acceso. Intentá nuevamente.', 503, undefined, true)
    }
  }
}
