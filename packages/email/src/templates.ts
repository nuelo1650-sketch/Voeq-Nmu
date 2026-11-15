// ---------------------------------------------------------------------------
// Email templates — Phase 0 set. Plain, honest copy in the voeq voice.
// Rule (build standards): no silent states — every state change emails the
// applicant what actually happened, including exceptions with their exact
// reason (Q-P6 decision). The email never lies.
// ---------------------------------------------------------------------------

export interface EmailTemplate {
  subject: string;
  html: string;
}

function shell(title: string, body: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#FAF6EC;padding:32px 16px;font-family:Georgia,serif;color:#0A0A0A;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:36px 32px;border:1px solid rgba(15,42,29,.12);">
    <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#D4922A;margin-bottom:14px;">
      NMU Business Register
    </div>
    <h1 style="font-size:24px;line-height:1.2;color:#0B211A;margin:0 0 16px;">${title}</h1>
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#4A4A4A;">${body}</div>
    <hr style="border:none;border-top:1px solid rgba(15,42,29,.1);margin:28px 0 16px;" />
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#7A7A7A;margin:0;">
      Nigeria Maritime University &middot; Okerenkoko &amp; Kurutie campuses<br/>
      Operated by the Media Unit &middot; A Voeq service
    </p>
  </div>
</body></html>`;
}

function ref(reference: string): string {
  return `<p style="margin:16px 0;padding:12px 16px;background:#F5F1E8;border-radius:12px;font-family:monospace;font-size:16px;color:#0F2A1D;">${reference}</p>`;
}

export function applicationReceived(reference: string, businessName: string): EmailTemplate {
  return {
    subject: `We have your application — ${reference}`,
    html: shell(
      "We have your application.",
      `<p><b>${businessName}</b> is in. The Media Unit reads every application itself — a person, not a machine.</p>
       <p>Your reference is:</p>
       ${ref(reference)}
       <p>Keep it. You can track progress any time with it. We commit to a decision within <b>five working days</b>, and we will email you here the moment there is one.</p>
       <p>Nothing is charged until your entry is approved.</p>`,
    ),
  };
}

export function correctionsRequested(
  reference: string,
  items: readonly { field: string; instruction: string }[],
): EmailTemplate {
  const list = items
    .map((i) => `<li style="margin-bottom:8px;"><b>${i.field}</b> — ${i.instruction}</li>`)
    .join("");
  return {
    subject: `One or two things need fixing — ${reference}`,
    html: shell(
      "A few things need fixing.",
      `<p>Your application ${reference} needs the following before we can continue:</p>
       <ul style="padding-left:20px;margin:16px 0;">${list}</ul>
       <p>Nothing is lost — you continue the same application with the same reference. Fix these and resubmit, and we read it again straight away.</p>`,
    ),
  };
}

export function applicationApproved(reference: string, businessName: string): EmailTemplate {
  return {
    subject: `Approved — one step left — ${reference}`,
    html: shell(
      "Your business is approved.",
      `<p><b>${businessName}</b> has been approved for the NMU business register.</p>
       <p>One step remains: a single transfer of <b>₦5,200</b> into the University's account, using <b>${reference}</b> as the transfer narration. When the University's bank record reaches us, we confirm and your entry goes live.</p>
       ${ref(reference)}
       <p>Your status page shows the exact account details and the payment step.</p>`,
    ),
  };
}

export function applicationRejected(reference: string, reason: string): EmailTemplate {
  return {
    subject: `A decision on your application — ${reference}`,
    html: shell(
      "A decision on your application.",
      `<p>We are not able to list <b>${reference}</b> at this time, for this reason:</p>
       <p style="padding:12px 16px;background:#F5F1E8;border-radius:12px;">${reason}</p>
       <p>If you believe this was a mistake, reply to this email — a person reads it.</p>`,
    ),
  };
}

export function feeConfirmed(reference: string, businessName: string): EmailTemplate {
  return {
    subject: `You are on the record — ${reference}`,
    html: shell(
      "Your business is on the record.",
      `<p>Payment confirmed. <b>${businessName}</b> is now registered in the official NMU business directory.</p>
       ${ref(reference)}
       <p>Your entry is public with this reference. Welcome to the record.</p>
       <p style="margin-top:20px;">P.S. — <a href="https://voeq.ng/for-vendors" style="color:#2D5A3D;">Do you also want to sell on Voeq?</a> The campus marketplace thousands of students already use. You are approved here; getting started there takes minutes.</p>`,
    ),
  };
}

export function feeAwaitingEvidence(reference: string): EmailTemplate {
  return {
    subject: `We have your payment claim — ${reference}`,
    html: shell(
      "We have your payment claim.",
      `<p>You have told us you have paid against ${reference}. The University's bank record reaches us once a day at 23:00; we confirm your entry on the <b>next working day</b> after it lands.</p>
       <p>No action is needed from you. If your payment does not appear within two working days, reply to this email with your transfer details.</p>`,
    ),
  };
}

export function paymentException(reference: string, concern: string): EmailTemplate {
  return {
    subject: `A problem with your payment — ${reference}`,
    html: shell(
      "A problem with your payment.",
      `<p>We received a payment we cannot yet attach to your application ${reference}. Here is exactly what is wrong:</p>
       <p style="padding:12px 16px;background:#F5F1E8;border-radius:12px;">${concern}</p>
       <p>The email does not guess — what is written above is what the bank record shows. Reply to this email or visit the Media Unit with your transfer receipt and we will resolve it.</p>`,
    ),
  };
}
