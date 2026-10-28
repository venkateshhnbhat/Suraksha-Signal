import { Resend } from 'resend';

export interface EmailProvider {
  sendOtpEmail(params: { to: string; code: string }): Promise<void>;
}

export class ResendEmailProvider implements EmailProvider {
  private resend: Resend | null = null;
  private fromAddress: string;

  constructor(apiKey?: string, fromAddress?: string) {
    const key = apiKey || process.env.RESEND_API_KEY;
    if (key) {
      this.resend = new Resend(key);
    }
    this.fromAddress = fromAddress || process.env.EMAIL_FROM || 'Suraksha Signal <noreply@surakshasignal.app>';
  }

  async sendOtpEmail({ to, code }: { to: string; code: string }): Promise<void> {
    const subject = 'Your Suraksha Signal login code';
    const text = `Your Suraksha Signal login code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request it, ignore this email.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #14b8a6; margin: 0; font-size: 22px; font-weight: 700;">🛡️ Suraksha Signal</h1>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Emergency SOS & Safety Network</p>
        </div>
        <div style="background-color: #1e293b; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #334155;">
          <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 12px 0;">Your one-time login verification code:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #38bdf8; font-family: monospace; padding: 12px; background-color: #0f172a; border-radius: 8px; display: inline-block;">
            ${code}
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0 0;">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
        </div>
        <p style="color: #64748b; font-size: 11px; text-align: center; margin-top: 24px;">
          Secure automated dispatch • Do not share this code with anyone.
        </p>
      </div>
    `;

    if (!this.resend) {
      if (process.env.NODE_ENV === 'test' || process.env.FUNCTIONS_EMULATOR === 'true' || !process.env.RESEND_API_KEY) {
        // In local development / emulator / test mode without key, log sanitized notification
        console.warn(`[Mock Email] RESEND_API_KEY not configured. Dispatched OTP email to ${to}.`);
        return;
      }
      throw new Error('RESEND_API_KEY is not configured in environment or Firebase secrets.');
    }

    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to: [to],
      subject,
      text,
      html
    });

    if (error) {
      throw new Error(`Failed to send email via Resend: ${error.message}`);
    }
  }
}

let defaultProvider: EmailProvider | null = null;

export const getEmailProvider = (): EmailProvider => {
  if (!defaultProvider) {
    defaultProvider = new ResendEmailProvider();
  }
  return defaultProvider;
};

export const setEmailProvider = (provider: EmailProvider | null) => {
  defaultProvider = provider;
};

