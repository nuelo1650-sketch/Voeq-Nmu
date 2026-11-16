// ---------------------------------------------------------------------------
// Email design system — Phase 0 set.
//
// Direction decided (Kai, 2026-11-16): **Direction B, the fuller letter** —
// reviewed at /dev/emails against Direction A (compact) and chosen as-is.
// Same skin for all eight; the body is a proper letter: an opening that
// talks to the applicant, a numbered walk-through, a "good to know" section,
// and a signature.
//
// Principles:
//   1. One skin, eight letters. Every email a person ever receives from the
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
//   7. Money deserves slow sentences: amounts, narrations and timelines are
//      spelled out, never rounded, never abbreviated.
//   8. Footer carries the full chain: university, operator, credit — and the
//      promise that a person reads replies.
//
// The catalogue of gates (which transition fires which letter) lives in
// docs/05-ROADMAP.md, "The email catalogue".
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

// --- letter-structure blocks --------------------------------------------------
function sectionHeading(label: string): string {
  return `<div style="font-family:${SANS};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.amberInk};margin:26px 0 10px;border-top:1px solid ${C.line};padding-top:22px;">${esc(label)}</div>`;
}

function stepsBlock(items: readonly string[]): string {
  const rows = items
    .map(
      (item, i) => `<tr>
        <td style="width:34px;vertical-align:top;padding:0 0 14px;">
          <div style="width:24px;height:24px;line-height:24px;text-align:center;border-radius:999px;background:${C.forest};color:${C.white};font-family:${SANS};font-size:12px;font-weight:bold;">${i + 1}</div>
        </td>
        <td style="vertical-align:top;padding:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.body};">${item}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function bulletsBlock(items: readonly string[]): string {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="width:34px;vertical-align:top;padding:0 0 10px;font-family:${SANS};font-size:15px;color:${C.amber};">•</td>
        <td style="vertical-align:top;padding:0 0 10px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.body};">${item}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function signoff(name = "The Media Unit"): string {
  return `<p style="font-family:${SERIF};font-size:15px;color:${C.forestInk};margin:24px 0 4px;">— ${esc(name)},</p>
  <p style="font-family:${SANS};font-size:13px;color:${C.muted};margin:0;">Nigeria Maritime University Business Register</p>`;
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
// The eight letters. Each one is fired by exactly one state transition —
// the catalogue of gates lives in docs/05-ROADMAP.md, "The email catalogue".
// ---------------------------------------------------------------------------

export function applicationReceived(
  reference: string,
  businessName: string,
  trackUrl?: string,
): EmailTemplate {
  return {
    subject: `Your application is in — ${reference} — and here is exactly what happens next`,
    html: shell({
      preheader: `${businessName} arrived safely. A person reads it. Decision within five working days — here is the whole road ahead.`,
      status: { label: "Received", tone: "forest" },
      title: "We have your application.",
      body: [
        para(`We have your application for <b>${esc(businessName)}</b>, and we wanted you to hear it from us first: it arrived safely, and a person — not a machine — will read every part of it.`),
        sectionHeading("What happens now"),
        stepsBlock([
          `A member of the Media Unit reads your application from top to bottom — the form, the documents, the photos.`,
          `If anything needs fixing, we write to you with exactly what and why. Nothing is lost; you continue the same application.`,
          `If it is approved, we send you the University's account details and the payment step — a single transfer of ₦5,200.`,
          `When the University's bank record confirms your payment, your business goes live in the official NMU directory.`,
        ]),
        refChip(reference),
        sectionHeading("Good to know"),
        bulletsBlock([
          `<b>Nothing is charged until your entry is approved.</b> Approval comes first; money comes second.`,
          `We commit to a decision within <b>five working days</b>. If it ever looks like we will miss that, we will tell you before you have to ask.`,
          `Keep this reference safe — it is the key to every future email, every status check, and your payment step.`,
        ]),
        para(`And if you ever want to ask something, simply reply to this email. A person reads every reply.`),
        signoff(),
      ].join(""),
      cta: trackUrl ? { href: trackUrl, label: "Track your application" } : undefined,
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
    subject: `${reference} is close — these few things need a second look`,
    html: shell({
      preheader: `We read your application today. It is close. ${items.length} thing${items.length === 1 ? "" : "s"} need${items.length === 1 ? "s" : ""} fixing — here is exactly what.`,
      status: { label: "Needs your attention", tone: "amber" },
      title: "A few things need fixing.",
      body: [
        para(`We read your application today. It is close — and before we can continue, the following need a second look:`),
        detailCard("Exactly what to fix", list),
        sectionHeading("What to do"),
        stepsBlock([
          `Fix each item above. Read the instruction slowly — most fixes take less than five minutes.`,
          `Open your application, update those fields, and resubmit. It is the same application; you are not starting over.`,
          `We re-read it the day it arrives. No queue-jumping, no penalty — a correction is a normal part of a careful register.`,
        ]),
        refChip(reference, "Same reference — nothing is lost"),
        para(`<b>Nothing from your application is lost.</b> Your details, your documents, your photos — all of it stays exactly where it was. You are only completing what is missing.`),
        para(`If any instruction above is unclear, reply to this email and ask. Clarity is free.`),
        signoff(),
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
    subject: `Approved: ${businessName} — the payment step, explained properly`,
    html: shell({
      preheader: `${businessName} is approved for the NMU register. One transfer of ₦5,200 puts you on the record — here is how to make it count.`,
      status: { label: "Approved", tone: "forest" },
      title: "Your business is approved.",
      body: [
        para(`<b>${esc(businessName)}</b> has been approved for the NMU business register. Congratulations — genuinely. Now there is exactly one step left, and because money deserves slow sentences, here is the whole thing explained.`),
        sectionHeading("The one step left"),
        stepsBlock([
          `Transfer <b>₦5,200</b> — no more, no less — into the University's account. The account details are on your payment page, copied and ready.`,
          `Put <b>${esc(reference)}</b> in the transfer narration exactly as written, character for character. This is how we find your money in the University's bank record — the narration is your name inside the bank's own ledger.`,
          `That is all. You do not send us a screenshot; the bank's record reaches us on its own, once a day at 23:00.`,
        ]),
        refChip(reference, "Your transfer narration"),
        sectionHeading("What happens after you pay"),
        stepsBlock([
          `The University's bank record arrives to us nightly at 23:00.`,
          `We match three independent signals: your reference, the exact amount, and the date.`,
          `When all three line up, a staff member confirms, your entry goes live in the official directory, and we email you the moment it happens.`,
        ]),
        sectionHeading("Three small things that save everyone time"),
        bulletsBlock([
          `Pay the <b>exact amount</b>. ₦5,000 or ₦5,500 will not match and will raise an exception letter instead of a confirmation.`,
          `Pay <b>once</b>. If your bank shows the transfer as pending, wait — do not send a second one.`,
          `Use the reference <b>exactly</b>. No extra spaces, no abbreviations.`,
        ]),
        signoff(),
      ].join(""),
      cta: { href: paymentStepUrl, label: "Open the payment step" },
    }),
  };
}

export function applicationRejected(reference: string, reason: string): EmailTemplate {
  return {
    subject: `A decision on ${reference} — the reason, written plainly`,
    html: shell({
      preheader: "We are not able to list this application at this time. The exact reason is written inside — and what you can do about it.",
      status: { label: "A decision", tone: "grey" },
      title: "A decision on your application.",
      body: [
        para(`We read your application for <b>${esc(reference)}</b> carefully, and we are not able to list it at this time. We do not send vague rejections, so here is the exact reason:`),
        detailCard("The exact reason", `<p style="margin:0;">${esc(reason)}</p>`),
        sectionHeading("If you believe this is a mistake"),
        stepsBlock([
          `Reply to this email and say so, plainly. A person reads it — usually the same day.`,
          `Or visit the Media Unit with your documents, and we will look again together.`,
          `If we were wrong, we reopen the application under the same reference. Reopening costs you nothing.`,
        ]),
        sectionHeading("What happens to your information"),
        bulletsBlock([
          `Your application stays on our records under the retention policy — it is not published anywhere.`,
          `If you resubmit later, the same reference continues your story.`,
        ]),
        para(`A register is only worth trusting if its no means what it says and its yes means what it says. This is our no, with its reason. If the reason is wrong, we want to hear it.`),
        signoff(),
      ].join(""),
    }),
  };
}

export function feeAwaitingEvidence(reference: string): EmailTemplate {
  return {
    subject: `We have your payment claim — ${reference} — and here is the timeline`,
    html: shell({
      preheader: "You have told us you paid. Here is exactly when the bank record arrives and when your confirmation happens. No action needed.",
      status: { label: "Payment pending", tone: "amber" },
      title: "We have your payment claim.",
      body: [
        para(`You have told us you have paid against ${esc(reference)}. Good — and here is exactly what happens from this moment, so you are never left wondering.`),
        sectionHeading("The timeline"),
        stepsBlock([
          `<b>Tonight, 23:00</b> — the University's bank record arrives to us. It arrives whether you paid or not; it is the bank's own record, not ours.`,
          `<b>Next working day</b> — we match your reference, the exact amount, and the date against that record. When they line up, a staff member confirms.`,
          `<b>The same day</b> — your entry goes live in the official directory and your confirmation email lands here.`,
        ]),
        refChip(reference),
        sectionHeading("If the record does not show it"),
        bulletsBlock([
          `<b>Wait two working days.</b> Banks are slow sometimes; that is normal.`,
          `After two working days with no confirmation, reply to this email with your transfer details — bank, amount, date, and time.`,
          `Please do not pay again. A second payment is the hardest kind of mistake to unwind.`,
        ]),
        para(`<b>No action is needed from you right now.</b> The next move belongs to the bank record, and it arrives on schedule.`),
        signoff(),
      ].join(""),
    }),
  };
}

export function feeConfirmed(reference: string, businessName: string, publicUrl: string): EmailTemplate {
  return {
    subject: `${businessName} is on the record — what that means for you`,
    html: shell({
      preheader: `Payment confirmed on the bank's own record. ${businessName} is now part of the official NMU business directory.`,
      status: { label: "Confirmed — on the record", tone: "solid" },
      title: "Your business is on the record.",
      body: [
        para(`Payment confirmed. <b>${esc(businessName)}</b> is now registered in the official NMU business directory — matched against the University's own bank record, confirmed by a person, and signed into the audit trail. Welcome to the record.`),
        refChip(reference, "Your official reference"),
        sectionHeading("What being on the record means"),
        bulletsBlock([
          `Your business is listed in the official directory, searchable by students and staff on both campuses.`,
          `This reference is your proof of registration. Keep it — it is the receipt the University recognises.`,
          `Any change to your entry later goes through the Media Unit, with the same care as this one.`,
        ]),
        sectionHeading("One thing worth knowing"),
        bulletsBlock([
          `<b>Nobody from this register will ever ask you for another payment.</b> The fee was one transfer of ₦5,200, and it is done. If anyone contacts you claiming otherwise, ignore them and tell the Media Unit.`,
        ]),
        para(`<b>P.S.</b> — Do you also want to <a href="https://voeq.ng/for-vendors" style="color:${C.forest};font-weight:bold;">sell on Voeq</a>? The campus marketplace thousands of students already use. You are approved here; getting started there takes minutes.`),
        signoff(),
      ].join(""),
      cta: { href: publicUrl, label: "See your public entry" },
    }),
  };
}

export function paymentException(reference: string, concern: string): EmailTemplate {
  return {
    subject: `About your payment — ${reference} — what the bank record shows, and the fix`,
    html: shell({
      preheader: "We received a payment we cannot yet attach to your application. Here is exactly what the bank record shows, and exactly what fixes it.",
      status: { label: "Action needed", tone: "amber" },
      title: "A problem with your payment.",
      body: [
        para(`Money deserves careful letters, so let us be precise: we received a payment that we cannot yet attach to your application ${esc(reference)}. This is not an accusation and not a loss — it is a mismatch, and mismatches have known fixes.`),
        detailCard("What the bank record shows", `<p style="margin:0;">${esc(concern)}</p>`),
        para(`That paragraph is copied from the University's own bank record — this email does not guess, and it does not round numbers off.`),
        sectionHeading("How this gets fixed"),
        stepsBlock([
          `Read the concern above and check it against your own transfer receipt.`,
          `If the record is right, do what it says — usually a small transfer of the difference, with the same reference in the narration.`,
          `If you believe the record is wrong, reply with your transfer receipt (bank, amount, date, time) or visit the Media Unit with it. We will trace it together.`,
        ]),
        sectionHeading("What we promise"),
        bulletsBlock([
          `Your application does not lose its place — it simply waits for the money to be fully accounted for.`,
          `Every kobo is matched against the bank's own record before your entry goes live. That is why your entry, once confirmed, means something.`,
        ]),
        para(`If anything above is unclear, reply to this email. A person reads it.`),
        signoff(),
      ].join(""),
    }),
  };
}

// Letter #8 — access link (on demand). Fires when an applicant asks the
// register to let them into their own application's page: reference + email
// matched, link minted, letter sent. Never fired proactively.
export function applicationAccessLink(
  reference: string,
  businessName: string,
  accessUrl: string,
  expiresMinutes: number,
): EmailTemplate {
  return {
    subject: `Your access link — ${reference} — one click opens your application's page`,
    html: shell({
      preheader: `One click opens ${businessName}'s page — the full story, the decisions, and your next step. The link works for ${expiresMinutes} minutes.`,
      status: { label: "Your access link", tone: "amber" },
      title: "Your link into the register.",
      body: [
        para(`Someone asked the register for a link into <b>${esc(businessName)}</b>'s application page, and this is it. If that someone was you, click the button below — everything about your application is behind it, exactly as the Media Unit sees it from their side.`),
        sectionHeading("What to do"),
        stepsBlock([
          `Click the button below within <b>${expiresMinutes} minutes</b> — the link expires after that, on purpose.`,
          `Your application's page opens: the full story so far, every decision made, and exactly what is required of you next.`,
          `If the link expires before you use it, no problem — request another from the same page. It costs nothing and it arrives in minutes.`,
        ]),
        refChip(reference, "The application this link opens"),
        sectionHeading("Good to know"),
        bulletsBlock([
          `This link is <b>personal</b> — it opens your application and nobody else's. Do not forward it.`,
          `The page never asks you for money and never asks you to re-enter your details. If a page does, it is not us.`,
          `Requesting a new link is always free. There is no limit and no penalty.`,
        ]),
        para(`If you did not request this link, ignore it — nothing happens without your click. And if you are curious who was asking: it may have been you on another device, or the Media Unit checking something with you. When in doubt, reply to this email and a person answers.`),
        signoff(),
      ].join(""),
      cta: { href: accessUrl, label: "Open my application's page" },
    }),
  };
}
