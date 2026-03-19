import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import nodemailer, { Transporter } from 'nodemailer'

type TemplateBlock = { title: string; body: string; ctaLabel?: string; ctaUrl?: string; footerNote?: string }

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
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    })
  }

  isEnabled() {
    return !!this.transporter
  }

  private renderLayout(content: TemplateBlock) {
    const appUrl = this.config.get<string>('APP_URL') || 'https://app.rbcrm.ru'

    const html = `
      <div style="background:#0b0f1a;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#111;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="padding:16px 20px;background:#0f172a;color:#fff;">
            <div style="font-size:22px;font-weight:700;letter-spacing:.2px;">rbCRM</div>
            <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">Сервис управления арендой</div>
          </div>

          <div style="padding:20px;line-height:1.55;color:#111827;">
            <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">${content.title}</h2>
            ${content.body}
            ${
              content.ctaLabel && content.ctaUrl
                ? `<p style="margin:18px 0 0;"><a href="${content.ctaUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600;">${content.ctaLabel}</a></p>`
                : ''
            }
          </div>

          <div style="padding:14px 20px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.4;">
            ${content.footerNote || 'Если вы не запрашивали это действие, просто проигнорируйте письмо.'}<br/>
            <a href="${appUrl}" style="color:#64748b;text-decoration:underline;">${appUrl}</a>
          </div>
        </div>
      </div>
    `

    const text = [
      'rbCRM',
      content.title,
      content.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      content.ctaUrl ? `Ссылка: ${content.ctaUrl}` : '',
      content.footerNote || 'Если вы не запрашивали это действие, просто проигнорируйте письмо.',
    ]
      .filter(Boolean)
      .join('\n\n')

    return { html, text }
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
    const body = `
      <p style="margin:0 0 10px;">Вы запросили сброс пароля в rbCRM.</p>
      <p style="margin:0 0 10px;">Токен для сброса:</p>
      <p style="margin:0 0 10px;font-family:monospace;font-size:14px;background:#f1f5f9;padding:10px;border-radius:8px;word-break:break-all;"><b>${token}</b></p>
      <p style="margin:0;">Токен действует 30 минут.</p>
    `

    const tpl = this.renderLayout({
      title: 'Сброс пароля',
      body,
      ctaLabel: 'Открыть страницу входа',
      ctaUrl: resetUrl,
      footerNote: 'Если вы не запрашивали сброс пароля, проигнорируйте письмо и никому не передавайте токен.',
    })

    return this.send(to, subject, tpl.html, tpl.text)
  }

  async sendEmailVerification(to: string, token: string) {
    const appUrl = this.config.get<string>('APP_URL') || 'https://app.rbcrm.ru'
    const verifyUrl = `${appUrl}/login?verifyEmailToken=${encodeURIComponent(token)}`

    const subject = 'Подтверждение регистрации rbCRM'
    const body = `
      <p style="margin:0 0 10px;">Спасибо за регистрацию в rbCRM.</p>
      <p style="margin:0 0 10px;">Токен подтверждения:</p>
      <p style="margin:0 0 10px;font-family:monospace;font-size:14px;background:#f1f5f9;padding:10px;border-radius:8px;word-break:break-all;"><b>${token}</b></p>
      <p style="margin:0;">Подтвердите email в течение 24 часов.</p>
    `

    const tpl = this.renderLayout({
      title: 'Подтвердите email',
      body,
      ctaLabel: 'Подтвердить email',
      ctaUrl: verifyUrl,
      footerNote: 'Если вы не регистрировались в rbCRM, просто проигнорируйте это письмо.',
    })

    return this.send(to, subject, tpl.html, tpl.text)
  }

  async sendPasswordChanged(to: string) {
    const subject = 'Пароль rbCRM успешно изменён'
    const tpl = this.renderLayout({
      title: 'Пароль обновлён',
      body: '<p style="margin:0;">Пароль вашего аккаунта успешно изменён.</p>',
      footerNote: 'Если это сделали не вы — срочно свяжитесь с поддержкой и выполните восстановление доступа.',
    })

    return this.send(to, subject, tpl.html, tpl.text)
  }

  async sendBillingSuccess(to: string, payload: { plan: string; amountRub: number; paidUntil?: Date | null }) {
    const paidUntil = payload.paidUntil ? new Date(payload.paidUntil).toLocaleDateString('ru-RU') : '—'
    const subject = 'Оплата подписки rbCRM прошла успешно'

    const body = `
      <p style="margin:0 0 8px;">Оплата получена.</p>
      <p style="margin:0 0 6px;">Тариф: <b>${payload.plan}</b></p>
      <p style="margin:0 0 6px;">Сумма: <b>${payload.amountRub} ₽</b></p>
      <p style="margin:0;">Подписка активна до: <b>${paidUntil}</b></p>
    `

    const tpl = this.renderLayout({
      title: 'Подписка активирована',
      body,
      ctaLabel: 'Открыть rbCRM',
      ctaUrl: this.config.get<string>('APP_URL') || 'https://app.rbcrm.ru',
      footerNote: 'Спасибо, что пользуетесь rbCRM.',
    })

    return this.send(to, subject, tpl.html, tpl.text)
  }
}
