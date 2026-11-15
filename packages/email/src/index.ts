// ---------------------------------------------------------------------------
// Resend adapter — the only outbound email path in the system.
// The outbox worker (pg-boss) consumes Notification rows and hands the payload
// here. Templates are plain functions returning { subject, html } — honest,
// reviewed copy; never assembled ad hoc at call sites.
// ---------------------------------------------------------------------------

import { Resend } from "resend";
import type { EmailTemplate } from "./templates";

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface EmailAdapter {
  send(to: string, template: EmailTemplate): Promise<SendResult>;
}

export class ResendAdapter implements EmailAdapter {
  private client: Resend | null = null;

  private getClient(): Resend {
    if (!this.client) {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("RESEND_API_KEY is not set — email cannot be sent");
      this.client = new Resend(key);
    }
    return this.client;
  }

  async send(to: string, template: EmailTemplate): Promise<SendResult> {
    const from = process.env.EMAIL_FROM ?? "NMU Business Register <register@voeq.ng>";
    try {
      const result = await this.getClient().emails.send({
        from,
        to,
        subject: template.subject,
        html: template.html,
      });
      if (result.error) return { ok: false, error: result.error.message };
      return { ok: true, id: result.data?.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const emailAdapter: EmailAdapter = new ResendAdapter();
export * from "./templates";
