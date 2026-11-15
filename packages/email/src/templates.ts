// ---------------------------------------------------------------------------
// Email design system — Phase 0 set.
//
// Principles (Kai, 2026-11-15: "professional, beautiful, well thought of —
// not default"):
//   1. One skin, seven letters. Every email a person ever receives from the
//      register is unmistakably the same sender: forest header, cream page,
//      serif voice, one amber reference chip, one footer. Consistency IS the
//      brand; nothing looks system-default.
//   2. Email-client honest. Table-based layout, inline styles, web-safe
//      fonts only (Georgia as the Playfair stand-in). No CSS masks, no
//      background-image tricks, no external font loads.
//   3. The reference chip never moves. Applicants learn to scroll, spot the
//      dashed box, copy the code. Same position, same look, every email.
//   4. Status pill tells the truth at a glance in the notification itself:
//      forest = good news, amber = something needs someone, grey = a decision.
//   5. Never more than one button, and only when a real next step exists.
//   6. Dynamic text (business names, reasons, concerns) is escaped —
//      applicant-typed data must never inject HTML into a letter.
//   7. Footer carries the full chain: university, operator, credit — and the
//      promise that a person reads replies.
// ---------------------------------------------------------------------------

export interface EmailTemplate {
  subject: string;
  html: string;
}

// --- palette (mirrors apps/registry globals.css tokens) ---------------------
const C = {
  forest: "#0F2A1D",
  forestInk: "#0B211A",
  forestTint: "#EAF0EB",
  cream: "#FAF6EC",
  paper: "#FFFFFF",
  line: "#E5DECE",
  amber: "#E8A33D",
  amberInk: "#8A5A14",
  amberTint: "#FBF1DE",
  body: "#4A4A4A",
  muted: "#8A8578",
  white: "#FFFFFF",
} as const;

const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- status pill ------------------------------------------------------------
type Tone = "forest" | "amber" | "grey" | "solid";

function pill(label: string, tone: Tone): string {
  const styles: Record<Tone, { bg: string; fg: string; border: string }> = {
    forest: { bg: C.forestTint, fg: C.forestInk, border: "#C9D8CD" },
    amber: { bg: C.amberTint, fg: C.amberInk, border: "#EFD9AE" },
    grey: { bg: "#F1EDE2", fg: "#5C5749", border: "#DCD5C3" },
    solid: { bg: C.forest, fg: C.white, border: C.forest },
  };
  const s = styles[tone];
  return `<span style="display:inline-block;padding:5px 14px;border-radius:999px;background:${s.bg};color:${s.fg};border:1px solid ${s.border};font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase;">${esc(label)}</span>`;
}

// --- reference chip -----------------------------------------------------------
function refChip(reference: string, caption = "Your reference — keep it"): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr><td style="border:2px dashed #C9BFA6;border-radius:12px;background:${C.cream};padding:16px 20px;text-align:center;">
      <div style="font-family:${SANS};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.muted};margin-bottom:6px;">${esc(caption)}</div>
      <div style="font-family:${MONO};font-size:22px;font-weight:bold;color:${C.forest};letter-spacing:.06em;">${esc(reference)}</div>
    </td></tr>
  </table>`;
}

// --- detail card (reasons, concerns, exact instructions) --------------------
function detailCard(label: string, innerHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">
    <tr><td style="border-left:3px solid ${C.amber};background:${C.cream};border-radius:0 12px 12px 0;padding:16px 20px;">
      <div style="font-family:${SANS};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.amberInk};margin-bottom:8px;">${esc(label)}</div>
      <div style="font-family:${SANS};font-size:15px;line-height:1.65;color:${C.forestInk};">${innerHtml}</div>
    </td></tr>
  </table>`;
}

// --- primary button (one per email, only when a next step truly exists) -----
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr><td style="background:${C.forest};border-radius:999px;">
      <a href="${esc(href)}" style="display:inline-block;padding:13px 28px;font-family:${SANS};font-size:14px;font-weight:bold;color:${C.white};text-decoration:none;">${esc(label)}</a>
    </td></tr>
  </table>`;
}

function para(innerHTML: string): string {
  return `<p style="font-family:${SANS};font-size:15px;line-height:1.65;color:${C.body};margin:14px 0;">${innerHTML}</p>`;
}

// --- the skin ---------------------------------------------------------------
export interface EmailSkin {
  preheader: string;
  status: { label: string; tone: Tone };
  title: string;
  body: string;
  cta?: { href: string; label: string };
}

function shell(skin: EmailSkin): string {
  const preheader = `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:${C.cream};">${esc(skin.preheader)}</div>`;

  const header = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.forest};border-radius:16px 16px 0 0;">
    <tr><td style="padding:22px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td align="left" style="font-family:${SERIF};font-size:22px;color:${C.white};letter-spacing:.04em;">Voeq</td>
        <td align="right" style="font-family:${SANS};font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${C.amber};">NMU Business&nbsp;Register</td>
      </tr></table>
    </td></tr>
  </table>`;

  const content = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
    <tr><td style="padding:30px 32px 12px;">
      ${pill(skin.status.label, skin.status.tone)}
      <h1 style="font-family:${SERIF};font-size:26px;line-height:1.25;color:${C.forestInk};margin:16px 0 4px;">${esc(skin.title)}</h1>
    </td></tr>
    <tr><td style="padding:0 32px 8px;">${skin.body}</td></tr>
    ${skin.cta ? `<tr><td style="padding:0 32px 20px;">${button(skin.cta.href, skin.cta.label)}</td></tr>` : ""}
  </table>`;

  const footer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border-radius:0 0 16px 16px;">
    <tr><td style="padding:8px 32px 26px;">
      <div style="border-top:1px solid ${C.line};padding-top:18px;">
        <p style="font-family:${SANS};font-size:12px;line-height:1.7;color:${C.muted};margin:0;">
          Nigeria Maritime University &middot; Okerenkoko &amp; Kurutie campuses<br/>
          Operated by the Media Unit &middot; A Voeq service &middot; Powered by Legacylm<br/>
          Reply to this email and a person reads it.
        </p>
      </div>
    </td></tr>
  </table>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${C.cream};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border:1px solid ${C.line};border-radius:16px;">
      ${header}${content}${footer}
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ---------------------------------------------------------------------------
// The seven letters. Each one is fired by exactly one state transition —
// the catalogue of gates lives in docs/05-ROADMAP.md, "The email catalogue".
// ---------------------------------------------------------------------------

export function applicationReceived(reference: string, businessName: string): EmailTemplate {
  return {
    subject: `We have your application — ${reference}`,
    html: shell({
      preheader: `${businessName} is in. A person reads every application — decision within five working days.`,
      status: { label: "Received", tone: "forest" },
      title: "We have your application.",
      body: [
        para(`<b>${esc(businessName)}</b> is in. The Media Unit reads every application itself — a person, not a machine.`),
        refChip(reference),
        para(`Keep it. You can track progress any time with it. We commit to a decision within <b>five working days</b>, and we will email you here the moment there is one.`),
        para(`<b>Nothing is charged until your entry is approved.</b>`),
      ].join(""),
    }),
  };
}

export function correctionsRequested(
  reference: string,
  items: readonly { field: string; instruction: string }[],
): EmailTemplate {
  const list = `<ol style="margin:8px 0;padding-left:22px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.forestInk};">` +
    items
      .map((i) => `<li style="margin-bottom:10px;"><b>${esc(i.field)}</b> — ${esc(i.instruction)}</li>`)
      .join("") +
    `</ol>`;
  return {
    subject: `A few things need fixing — ${reference}`,
    html: shell({
      preheader: `${items.length} item${items.length === 1 ? "" : "s"} need your attention before we can continue with ${reference}.`,
      status: { label: "Needs your attention", tone: "amber" },
      title: "A few things need fixing.",
      body: [
        para(`Your application needs the following before we can continue:`),
        detailCard("Exactly what to fix", list),
        refChip(reference, "Same reference — nothing is lost"),
        para(`You continue the <b>same application</b> with the same reference. Fix these, resubmit, and we read it again straight away.`),
      ].join(""),
    }),
  };
}

export function applicationApproved(
  reference: string,
  businessName: string,
  paymentStepUrl: string,
): EmailTemplate {
  return {
    subject: `Approved — one step left — ${reference}`,
    html: shell({
      preheader: `${businessName} is approved. One transfer of ₦5,200 with ${reference} as narration puts you on the record.`,
      status: { label: "Approved", tone: "forest" },
      title: "Your business is approved.",
      body: [
        para(`<b>${esc(businessName)}</b> has been approved for the NMU business register.`),
        para(`One step remains: a single transfer of <b>₦5,200</b> into the University's account, using <b>${esc(reference)}</b> as the transfer narration. When the University's bank record reaches us, we confirm and your entry goes live.`),
        refChip(reference, "Use this as your transfer narration"),
        para(`Your payment page shows the exact account details, copied for you.`),
      ].join(""),
      cta: { href: paymentStepUrl, label: "View the payment step" },
    }),
  };
}

export function applicationRejected(reference: string, reason: string): EmailTemplate {
  return {
    subject: `A decision on your application — ${reference}`,
    html: shell({
      preheader: "A decision has been made. The exact reason is written inside — no guessing.",
      status: { label: "A decision", tone: "grey" },
      title: "A decision on your application.",
      body: [
        para(`We are not able to list <b>${esc(reference)}</b> at this time, for this reason:`),
        detailCard("The exact reason", `<p style="margin:0;">${esc(reason)}</p>`),
        para(`If you believe this was a mistake, reply to this email — a person reads it.`),
      ].join(""),
    }),
  };
}

export function feeAwaitingEvidence(reference: string): EmailTemplate {
  return {
    subject: `We have your payment claim — ${reference}`,
    html: shell({
      preheader: "No action needed. The University's bank record reaches us daily; we confirm the next working day.",
      status: { label: "Payment pending", tone: "amber" },
      title: "We have your payment claim.",
      body: [
        para(`You have told us you have paid against ${esc(reference)}. The University's bank record reaches us once a day at 23:00; we confirm your entry on the <b>next working day</b> after it lands.`),
        refChip(reference),
        para(`<b>No action is needed from you.</b> If your payment does not appear within two working days, reply to this email with your transfer details.`),
      ].join(""),
    }),
  };
}

export function feeConfirmed(reference: string, businessName: string, publicUrl: string): EmailTemplate {
  return {
    subject: `You are on the record — ${reference}`,
    html: shell({
      preheader: `Payment confirmed. ${businessName} is now registered in the official NMU business directory.`,
      status: { label: "Confirmed — on the record", tone: "solid" },
      title: "Your business is on the record.",
      body: [
        para(`Payment confirmed. <b>${esc(businessName)}</b> is now registered in the official NMU business directory.`),
        refChip(reference, "Your official reference"),
        para(`Your entry is public with this reference. Welcome to the record.`),
        para(`<b>P.S.</b> — Do you also want to <a href="https://voeq.ng/for-vendors" style="color:${C.forest};font-weight:bold;">sell on Voeq</a>? The campus marketplace thousands of students already use. You are approved here; getting started there takes minutes.`),
      ].join(""),
      cta: { href: publicUrl, label: "See your public entry" },
    }),
  };
}

export function paymentException(reference: string, concern: string): EmailTemplate {
  return {
    subject: `A problem with your payment — ${reference}`,
    html: shell({
      preheader: "We received a payment we cannot yet attach to your application. The exact problem is written inside.",
      status: { label: "Action needed", tone: "amber" },
      title: "A problem with your payment.",
      body: [
        para(`We received a payment we cannot yet attach to your application ${esc(reference)}. Here is exactly what is wrong:`),
        detailCard("What the bank record shows", `<p style="margin:0;">${esc(concern)}</p>`),
        para(`This email does not guess — what is written above is what the bank record shows. Reply to this email or visit the Media Unit with your transfer receipt and we will resolve it.`),
      ].join(""),
    }),
  };
}
