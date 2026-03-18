import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import nodemailer, { Transporter } from 'nodemailer'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private transporter: Transporter | null = null
  private from = ''

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST')
    const port = Number(this.config.get<string>('SMTP_PORT') || 0)
    const user = this.config.get<string>('SMTP_USER')
    const pass = this.config.get<string>('SMTP_PASS')
    const secure = String(this.config.get<string>('SMTP_SECURE') || 'true').toLowerCase() === 'true'
    this.from = this.config.get<string>('SMTP_FROM') || (user ? `rbCRM <${user}>` : '')

    if (!host || !port || !user || !pass || !this.from) {
      this.logger.warn('SMTP not fully configured: email sending is disabled')
      return
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    })
  }

  isEnabled() {
    return !!this.transporter
  }

  async send(to: string, subject: string, html: string, text?: string) {
    if (!this.transporter) return { ok: false, reason: 'disabled' }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ' '),
      })
      return { ok: true }
    } catch (e) {
      this.logger.error(`send failed to ${to}: ${e instanceof Error ? e.message : String(e)}`)
      return { ok: false, reason: 'send_failed' }
    }
  }

  async sendPasswordReset(to: string, token: string) {
    const appUrl = this.config.get<string>('APP_URL') || 'https://app.rbcrm.ru'
    const resetUrl = `${appUrl}/login?resetToken=${encodeURIComponent(token)}`

    const subject = 'Сброс пароля rbCRM'
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">Сброс пароля</h2>
        <p>Вы запросили сброс пароля в rbCRM.</p>
        <p>Токен для сброса: <b>${token}</b></p>
        <p>Страница входа: <a href="${resetUrl}">${resetUrl}</a></p>
        <p style="color:#666">Токен действует 30 минут.</p>
      </div>
    `
    return this.send(to, subject, html)
  }

  async sendBillingSuccess(to: string, payload: { plan: string; amountRub: number; paidUntil?: Date | null }) {
    const paidUntil = payload.paidUntil ? new Date(payload.paidUntil).toLocaleDateString('ru-RU') : '—'
    const subject = 'Оплата подписки rbCRM прошла успешно'
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">Оплата получена</h2>
        <p>Тариф: <b>${payload.plan}</b></p>
        <p>Сумма: <b>${payload.amountRub} ₽</b></p>
        <p>Подписка активна до: <b>${paidUntil}</b></p>
      </div>
    `
    return this.send(to, subject, html)
  }
}
