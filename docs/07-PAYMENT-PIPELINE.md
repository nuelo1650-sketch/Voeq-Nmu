# 07 — Payment Pipeline

> **Status:** architecture of record, 15 Nov 2026. Rewritten around the model
> Kai confirmed: **one dedicated account number, money divided at the account.**
>
> This document takes the school-owned-account architecture Kai supplied
> (school-owned bank account, direct student transfers, no provider, no virtual
> accounts, no custody by Voeq), adapts it to Nigeria Maritime University, and
> then says plainly where it is right, where it is incomplete, and where I would
> change it.
>
> **§2 is the model. §3 is the one question that must be answered before any
> code is written. §4 is who does what. §5 is the gaps. §6 is what I would
> change. §7 is the business risk. §8 is the open questions. §9 is the build
> order.**

---

## 0. The money game, in one screen

For non-engineers — the whole design in three sentences:

1. Every approved business **owes exactly ₦5,200**, and the register knows it
   *before* any money moves (the fee intent is issued at approval).
2. The bank's own statement says **what actually arrived** — and no admin can
   change what the bank says.
3. The screen the finance officer opens every morning shows three numbers —
   **expected, arrived, confirmed** — and they must always add up:
   `arrived = ₦5,200 × confirmed + credits still being processed`. When they
   don't add up, the screen says so in red. It never stays silent.

Everything after this section is detail protecting those three sentences.

---

## 1. What the supplied architecture gets right

These are not hedges. They are correct, and I would not change them.

**1.1 No custody is the correct call.** If Voeq never holds the student's money, then
Voeq is not a payment service provider. No licensing, no trust account, no
segregation of client funds, no PCI scope beyond whatever the receipt upload
touches, and no chargeback exposure. The operational surface shrinks to "a ledger
that is right", which is a problem a good engineer can actually solve. Custody
would have been a licence to operate a small bank.

**1.2 The core invariant is the right one.** `revenue = ₦200 × confirmed
registrations` states the thing that must always be true, and it is stated in
terms of *confirmed registrations* rather than *money received*. That distinction
is the whole design. It survives a late payment, a partial remittance, and a
reconciliation dispute, because it never depends on cash having moved in a
particular order.

**1.3 Receivable mode, not custody mode, is correctly named.** A double-entry ledger
with `Dr receivable:from_school / Cr revenue:platform_fee` and memorandum tracking
of school-collected totals is the right accounting shape for money you are owed
rather than money you hold.

**1.4 A student's screenshot is never the source of truth.** Correct, and it is the
rule most likely to be quietly broken by a well-meaning staff member under time
pressure. It must be enforced in the schema — a `payment` cannot exist without a
`bank_credit_event` behind it — not just in a policy document.

**1.5 Maker-checker on fee confirmation.** Correct. The person who enters the bank
statement and the person who confirms the fee must be different people.

**1.6 Hash-chained audit log.** Correct instinct. See §6.2 for the one change I
would make.

**1.7 A blocking final close.** Correct. A period that cannot be closed until every
credit in it is matched, allocated or excepted is the only way the ledger stays
true.

**1.8 Gate battery.** Correct. Every state transition gated by an explicit
predicate rather than by a code path that happens to work.

---

## 2. The architecture: one dedicated account, money divided at the account

> **Kai, 15 Nov 2026:** *"there will be a place to count money — Voeq's money and
> school's money. Voeq's own is 200, school's own is 5000. So now the transactions
> pipeline itself is one dedicated account number where these money can be
> divided."*

This is the model. It is cleaner than both readings I originally documented, and it
settles the question the supplied document left open.

### 2.1 The shape

```
        STUDENT                THE DEDICATED ACCOUNT              VOEQ
           │                            │                          │
  ① apply │                            │                          │
           ├── approved ───────────────▶ │                          │
           │                            │                          │
  ② pay   ├── ₦5,200 ─────────────────▶ │  NMU Business            │
           │                            │  Registration Account     │
  ③ receipt│                            │  (one account number)     │
      upload                            │                            │
           │                            │  ─────────────┬─────────── │
           │                            │   division:   │           │
           │                            │   school ₦5,000           │
           │                            │   voeq   ₦200 ───────────▶│
           │                            │                            │
  ④ statement CSV ─────────────────────▶ │                            │
           │                            │                            │
  ⑤ match + allocate                    │                            │
           │                            │                            │
  ⑥ checker confirms ───────────────────┼────────────────────────────▶│
           │                            │                            │
  ⑦ registered + listed                 │      Dr receivable / Cr revenue
           │                            │                            │
  ⑧ remittance ────────────────────────┼───────────────────────────▶│
           │                            │      Dr cash / Cr receivable
```

**One account number. Two claims on every credit. One log.**

### 2.2 The two balances, side by side

The dedicated account's money is not one balance. It is **two balances that must
always be counted separately**, and the whole point of the admin is to keep them
apart:

| | Amount per registration | Meaning | Whose is it |
| --- | --- | --- | --- |
| **School share** | ₦5,000 | The University's registration fee | NMU's. Held in the dedicated account until swept to NMU finance. |
| **Voeq share** | ₦200 | The platform fee | Voeq's. A receivable on NMU until remitted. |
| **Credit** | **₦5,200** | What the student actually transfers | The sum of the two. |

**The invariant is two-sided now, and both halves must hold:**

```
revenue_voeq        = ₦200 × confirmed registrations
school_share_held   = ₦5,000 × confirmed registrations      (memorandum only)
credit_in_account   = ₦5,200 × confirmed registrations
```

The second line is **memorandum** — it is not our revenue and must never appear
in our income. It exists so the split can be proven, audited and reported. This is
the exact discipline the supplied architecture asked for, now with the school side
made explicit.

### 2.3 The account's ownership — the thing that must be right

**The dedicated account must be NMU's, at NMU's bank, in NMU's name.**

If Voeq opened the account, or if it were a jointly-held or Voeq-operated
collection account, then Voeq would be receiving the ₦5,000 school share and
holding it. That is custody — precisely what the whole architecture exists to
avoid, and it would pull in trust-account rules, a licence question, and a
segregation requirement we do not want.

So:

- **The account is opened by NMU** (central finance), called something like
  *NMU Business Registration Account*. It is a **dedicated** account, not the
  University's general operating account, because the whole point is that the
  total is countable in one place and the split is provable.
- **Students transfer into it**, quoting `NMU-2026-XXXX`.
- **NMU's finance sweeps the school share out** on a schedule, and **remits
  Voeq's ₦200 share** to Voeq on the same or a related schedule.
- **Voeq never holds the account and never touches the ₦5,000.**

That last line is what keeps us out of custody, and it is why the split, rather
than the money, is what our ledger records.

### 2.4 Where Voeq's books differ from NMU's

| | NMU finance | Voeq |
| --- | --- | --- |
| Owns the account | yes | no |
| Records the full credit | yes (₦5,200) | no |
| Records the school share | yes (₦5,000) | **no** — memorandum only, for proof of split |
| Records the Voeq share | no | **yes** (₦200) — this is our revenue |
| Sees the daily statement | yes | yes — **the same file**, as evidence |
| Reconciles | the account | our receivable against the remittance |

Both sides see the same statement. Neither can rely on the other having done it
correctly. That is the point of a shared source of truth.

### 2.5 The dedicated account versus the University's general account

Worth deciding explicitly, because it changes the accounting and it changes who
can count what:

| | **Dedicated registration account** | **General operating account** |
| --- | --- | --- |
| Totals countable in one place | **yes** | no — mixed with salaries, fees, grants |
| Split provable without a filter | **yes** | only with effort and error |
| Audit | trivial | painful |
| Students' transfers visible among unrelated traffic | no | yes, which invites mis-matching |
| Admin's daily work | easy | hard |

**Recommendation: the dedicated account.** The phrase "a place to count money" is
the strongest argument for it — a general account cannot be counted.

### 2.6 How a payment is verified — the no-mistake chain

Kai's requirement: *"a method that allows no room for mistakes."* The method is
a chain where **every link is enforced in code and none in policy**, and where
no single signal is ever trusted alone:

```
approval ──▶ fee_intent (NMU-2026-XXXX, ₦5,200 exact, rate snapshot)
                │
student pays ──▶ the reference is in the transfer narration
                │
nightly ────────▶ bank's own statement CSV ──▶ hashed, stored as evidence
                │                             ONLY this file creates a
                │                             bank_credit row (never a
                │                             screenshot, never an alert)
                ▼
matcher: reference-first · exact-amount-only · date-window
                │   anything imperfect → exception queue. No guessing,
                │   no fuzzy matching, no partial matches.
                ▼
MAKER stages the match ──▶ CHECKER (different account) sees intent,
                           credit and proposed allocation side by side
                           and confirms. Nobody confirms alone.
                ▼
allocation posts (₦5,000 memo / ₦200 revenue) ──▶ registered
                ──▶ Resend email to the applicant, same moment
```

The rules that leave no room for mistakes:

1. **Intent first.** No fee intent, nothing to match, nothing confirmable. A
   payment cannot exist for a reference the register did not issue.
2. **The bank's file is the only origin of truth.** A `bank_credit` row can be
   created by the statement import alone. Screenshots, alerts and phone calls
   can annotate; they can never create state.
3. **Exact amount only.** ₦5,150 is not ₦5,200. No tolerance, no rounding —
   an off-amount credit is an exception for a human, automatically.
4. **Reference-first, never reference-alone.** The reference selects the
   candidate; the exact amount and a date window must agree. Two of three
   signals is not a match.
5. **Nothing auto-confirms.** Matching may *stage*; only a checker account —
   a different person from the maker — confirms. The confirm action is
   gated on the checklist being viewed.
6. **Nothing happens twice.** A second credit with the same reference + amount
   warns and waits; it can never post a second allocation.
7. **Nothing silent.** Every transition — awaiting evidence, matched, exception
   with its exact reason, confirmed — emails the applicant via Resend at the
   moment it happens.
8. **Nothing unlogged.** Every action lands in the append-only, hash-chained
   audit log; `audit_log` has no UPDATE/DELETE grant at the database level.

The applicant-visible state machine this produces (doc §5.2):
`awaiting_bank_evidence → matched → confirmed` — with an emailed, specific
message at each step, including the exception path: *an orphaned or
mismatched credit emails the person its exact concern* (Q-P6 decision, §8).

---

## 3. The question that must be answered before code is written

One question, and it is not about the ledger. It is about **who sweeps what, when**.

> **Q-P1 — the settlement schedule.**
> The dedicated account holds two claims. The school share must be swept out to
> NMU finance, and the Voeq share must be remitted to Voeq. What are the cadences,
> and who signs each one off?

Everything else in the design can be written against a configurable answer, but
these three need a number and a name:

| | Question | Why it blocks |
| --- | --- | --- |
| a | How often is the **school share** swept to NMU finance? | The school-side balance in the admin is meaningless without a cadence |
| b | How often is the **Voeq share** remitted, and does the remittance advice itemise references? | Determines whether our receivable can be settled without a manual matching exercise |
| c | Who at NMU signs the monthly split reconciliation? | The maker-checker on our side needs a counterpart on theirs |

**Recommended defaults, if the Department has no preference:**

- School share swept to NMU finance **weekly**, on the same run as the Voeq
  remittance — so both sides move together and the split is provable in one
  document.
- Voeq share remitted **weekly**, with a remittance advice listing each
  `NMU-2026-XXXX` reference it settles.
- One joint reconciliation a month, signed by the Department's finance officer
  and countersigned by Voeq, covering: credits received, allocation, both
  balances, and the remittances.

**Second question, less urgent but worth raising early (Q-P2):** is the ₦200
platform fee itself agreed in writing, and for how long? If the fee changes
mid-year, history must not restate — so the rate has to be versioned (§6.3).

**Third (Q-P3):** the formal title of the reviewing authority, and the formal
title of whoever operates the account. These land on bank forms and remittance
advances, so they cannot be "Media Department" in the abstract.

---

## 4. Who tracks and who keeps the logs

Kai asked: *"I don't know which admin will track and keep logs of these."*

Here is the answer, and it is a recommendation rather than a guess.

### 4.1 The account sits with NMU central finance

The dedicated account is opened and operated by **NMU central finance**, because
it is NMU's money, it is in NMU's name, and it must be audited by whoever audits
NMU. A media department opening and holding a bank account is a governance
problem, not just an operational one.

### 4.2 The Media Unit operates the ledger day to day

The **Media Unit's finance officer** is the person who actually works the
register desk's fee ledger: they import the nightly statement, stage matches,
prepare the split, and chase the exceptions. They know the businesses. They are
already the people who answer the applicant's "has my payment gone through?"
question, and this puts the answer and the evidence in the same place.

The ledger is a **system of record for every payment in the register** — every
credit, its allocation, both balances, every remittance, and every exception, with
an append-only audit trail naming the person who acted.

### 4.3 NMU central finance owns the account and signs the month

Central finance owns the account itself, sweeps the school share, executes the
remittance to Voeq, and signs the monthly split reconciliation. They are the
maker-checker counterpart to our own.

### 4.4 The division of labour

| Action | Media Unit finance officer | NMU central finance | Voeq |
| --- | --- | --- | --- |
| Import the nightly statement | **does** | receives the file | ingests the same file as evidence |
| Stage a match and its allocation | **does** | — | records |
| Confirm the fee (checker) | **does** (second officer) | — | records |
| Sweep the school share out | — | **does** | observes |
| Remit the ₦200 to Voeq | prepares the advice | **executes** | receives, matches against the receivable |
| Monthly split reconciliation | **prepares** | **signs** | countersigns |
| Write off an exception | **proposes** | — | **approves** (checker) |
| Close the period | — | — | **does** |

**The daily log lives in the register desk.** The Media Unit's fee ledger is the
screen where every payment is tracked, where the two balances are counted, and
where the append-only trail lives. That is the "place to count money".

### 4.5 Permissions

| Role | Who | Can do |
| --- | --- | --- |
| Applicant | Student or staff | Submit an application, see their own status page, upload a receipt, claim an unmatched payment |
| Media officer | NMU Media Unit | Assess applications, request corrections, approve, reject |
| Ledger operator (maker) | Media Unit finance officer | Import the statement, stage matches, prepare the split, raise exceptions |
| Confirming officer (checker) | Media Unit finance officer, a second person | Confirm a fee, reject a receipt, approve a write-off |
| Account owner | NMU central finance | Sweep the school share, execute the remittance, sign the monthly reconciliation |
| Platform admin | Voeq | Manage the fee schedule, open and close periods, grant roles |
| Read-only auditor | Voeq / University audit | Read the ledger and the audit chain; cannot write |

**Maker-checker applies to exactly two actions** in phase 1: *confirming a fee*
and *writing off an exception*. Everything else is single-operator. Over-applying
maker-checker makes the process slow enough that people route around it, which is
worse than not having it.

### 4.6 Two admin families that cannot mix (Q-P6 decision, 15 Nov)

Kai's requirement: *"voeq admin dashboard and media admin dashboard — same
admin, different moderation actions and jobs — these can't get mixed up in any
manner or way."* Architecturally:

| | **Platform family (Voeq)** | **Register family (Media Unit)** |
| --- | --- | --- |
| Scope | The website in general: institutions, categories, fee schedule, integrations, monitoring | The register itself: reviewing applications, requesting corrections, approving, the fee ledger |
| Can it touch the other family? | **No.** A platform account cannot review an application or confirm a fee | **No.** A register account cannot change fee schedules, grant roles, or alter institution config |
| Super admin | Lives here: grants and revokes roles, opens periods | Does not exist here |

Rules, all enforced in code:

1. **Families are mutually exclusive.** An account holds roles from one family
   or the other — never both. The permission matrix rejects any assignment
   that would mix them.
2. **Roles attach to accounts, not people.** Nobody is "the admin"; an account
   is granted privileges, and grants are revocable. Person-bound admin is how
   mistakes become unrecoverable.
3. **Every grant and revocation is itself an audited event** — who granted,
   what, to whom, when. Including self-assignments: a super admin granting
   themselves a role is logged like any other action.
4. **The audit log is never deletable.** Append-only at the database level
   (no UPDATE/DELETE grants on `audit_log` for any role, including super
   admin), hash-chained per entity, with the acting account on every row.
   Nothing gets missing in action — not orphaned credits, not double payments,
   not role changes, nothing.
5. **Consequential actions allow review before execution.** Destructive or
   money-touching actions (confirm fee, write-off, period close, role grant)
   present a review screen with the exact effect spelled out, require explicit
   agreeance, and log the agreeance. Signing (Q-P1) is deliberately this
   light: **a logged check, not a signature ceremony** — the record is in the
   audit chain, not in a scanned signature.


### 4.7 Admin identity — Google OAuth only (Kai, 15 Nov)

**The only way anyone signs into the admin is Google OAuth.** No staff
passwords exist. Consequences, all deliberate:

- **Identity is a real Google account.** Passwords get shared and reused;
  Gmail accounts do not change hands casually. The person in the audit log is
  the person who owns that Google account.
- **The log carries the email.** Every audit row and every session is keyed to
  the verified Google email — "who did this" always has an answer that
  resolves to a real, recoverable identity.
- **Access is an allowlist.** A staff member can sign in only if their Google
  email is on the institution's allowlist. Revoking access = removing the
  email. Compromised password resets disappear as a problem class.
- **Applicants are unaffected** — they keep magic links and OTP, no Google
  account required.
- Portals whose credentials belong to the school (the bank portal) are
  explicitly out of scope: Voeq never holds them, per §8.1 item 11.

### 4.8 Statement routine and bank code — what they are and why

Kai asked why the onboarding list (§8.1) includes them:

- **Statement routine (item 7)** — the daily habit that feeds the whole
  pipeline: *who* exports the CSV, *to which inbox*, *at what time*. Needed
  because the statement is the source of truth: if it does not arrive, we are
  blind, and the applicant's SLA copy ("the bank record reaches us once a day
  at 23:00") is only honest if the routine actually exists. It also defines
  the alert cross-check window (§5.1) and who to ask when a credit is missing.
- **Bank code (item 5)** — the bank's NIBSS/sort code. Needed on the remittance
  advice (a transfer to Voeq must name the sending bank), for reading the
  `source bank` column of statement rows, and for any future refund (a refund
  transfer must specify the destination bank). One code, three jobs.

---

## 5. Gaps in the supplied architecture

### 5.1 The bank-evidence feed — the real critical path

The supplied document ends with its own question:

> how will the school give you the bank evidence — a daily statement CSV export,
> bank alerts forwarded to a finance officer, or read-only statement access?

My answer: **daily statement CSV as the source of truth. Bank alerts only as a
same-day accelerator. Read-only access as a later optimisation.**

| Feed | Verdict |
| --- | --- |
| **Daily statement CSV** | **Primary.** Manual, but complete, auditable and hashable. The finance officer exports one in under a minute. It gives us a file we can store and hash as evidence — exactly what an audit needs. No bank relationship, no API contract, no security review at the bank. |
| **Bank alerts** | **Cross-check signal, never the source of truth.** Alerts (SMS / email credit notifications) forwarded to a dedicated register inbox are a **second, independent signal**: if a credit appears in an alert but never appears in a statement within 2 working days, the system raises a flag — *the bank's own records disagree with what the school sent us*. That is genuine independent verification without custody or an API. Alerts still never create a `bank_credit_event` on their own. |
| **Read-only statement access** | **Best, slowest.** If NMU has API or open-banking access to its account, that is the ideal feed. It will take months to arrange and adds a third party to the critical path. Build for it, do not wait for it. |

**The honest boundary, stated once:** without a bank API, the statement *is*
the bank's word — we cannot be more independent than the bank's own documents.
What we can do, and what the design does, is hold **three signals that must
agree**: the statement CSV, the forwarded alerts, and our own fee-intent
ledger. Every fraud edge is a disagreement between signals, and every
disagreement has an owner:

| Fraud / error edge | How the signals catch it |
| --- | --- |
| Fake "I have paid" screenshot | Never creates state — the intent simply stays `awaiting_bank_evidence` until a real statement row arrives. Nothing to fake. |
| Invented/mistyped reference by the student | The credit lands with a narration that matches no intent → exception queue, emailed to the applicant with the exact reason. |
| Double payment (student pays twice) | Same reference + amount twice → second credit warns and waits; cannot post a second allocation. |
| Someone edits the CSV before handing it over | The file is hashed on import; the hash is stored; a re-import of a different file for the same day fails loudly. |
| A credit that exists at the bank but is missing from the school's export | The alert cross-check (above) flags it within 2 working days. |
| Insider: operator confirms a fee that was never matched | The confirm gate requires a matched credit behind it in the schema — not a policy. The gate battery rejects it; the attempt is logged. |
| Insider: maker confirms their own match | Maker-checker is enforced by account identity — the checker's Google account must differ from the maker's. |
| **Staff member hides a payment entirely (theft)** | The expected money is on record *before* it exists — every approval issued a ₦5,200 intent. The statement comes **from the bank, not from staff**, so the money's arrival cannot be edited away; and NMU **central finance** — who owns the account and signs the monthly reconciliation — sees the real balance independent of anyone in the Media Unit. If a credit is confirmed but the money isn't in the account, the three numbers stop adding and the flag is on one screen. An admin can hide a *process step*; they cannot hide what the bank says. |

**Pending payments** are a designed state, not a hole: from the moment the
applicant submits "I have paid", the status page shows
`awaiting_bank_evidence` with its SLA copy ("the University's bank record
reaches us once a day at 23:00; we confirm on the next working day"). The
money cannot be confirmed early, and the applicant is never left guessing.

The requirement that follows: **the ingestion source must be pluggable from day
one.** Model the feed as an interface — `BankFeed.fetch(day) → normalised
credits[]` — with a CSV implementation first. The matching, allocation and ledger
code must never know where the credits came from.

### 5.1a What the evidence types are — and are not

Kai asked whether "statement CSV" means payment screenshots, and asked us not
to limit evidence to one type. Correct on the second point; important to be
precise on the first. There are **three types of evidence, with different
powers**:

| Type | What it actually is | What it can do |
| --- | --- | --- |
| **Statement CSV** | The bank's *own* export of every transaction into the account — a spreadsheet generated by the bank, not assembled by any human | **The only thing that can create a `bank_credit` row.** Source of truth. |
| **Bank alerts** | The bank's automatic SMS / email "credit received" notices, forwarded to a dedicated register inbox | Cross-check signal — flags disagreements with the statement. Never creates state. |
| **Applicant uploads** (screenshots, receipts) | The student's own evidence of having paid | Lets the applicant say "I have paid", starts the SLA clock, annotates the intent. **Never creates a credit.** |

The principle: the truth comes from the bank, the cross-check comes from the
bank, and the applicant's screenshot is *their word* — respected, recorded,
shown to the reviewer — but never the truth by itself. Evidence is not limited
to one type; exactly one type is allowed to move money.

### 5.2 The waiting state is not specified, and the applicant will feel it

The document is written from the ledger's point of view. It does not say what the
student sees between "I paid" and "confirmed". Under a CSV feed the money is in
the account but our ledger does not know about it until the next statement.

This needs an explicit state with its own message and its own SLA:

```
submitted → awaiting_bank_evidence → matched → confirmed
```

And the applicant-facing copy must be true and specific:

> We have your receipt. The University's bank record reaches us once a day at
> 23:00. We confirm your entry on the next working day. Your reference is
> NMU-2026-0042.

Do not say "we'll email you when it's confirmed" and then go quiet for two days.
That is the most likely source of "I paid and nobody called me" complaints, and
it is the complaint that costs the Department goodwill with the students it
depends on.

### 5.3 Orphaned credits are not handled

The document covers matching, dedupe and exceptions, but not the case that
actually generates cash-handling work: **a credit arrives that belongs to nobody
we can identify.**

Common causes:

- the student paid with a **wrong or missing reference**;
- the student paid the **wrong amount** (₦5,150, or ₦5,000 when ₦5,200 was due);
- a **third party paid** on the student's behalf, so the payee name does not match;
- a **double payment** — the student paid again because the first was not confirmed.

We need a defined path for each:

1. **Wrong reference, right amount, right payee name.** Recoverable by matching on
   payee name + amount + date window. Must be a *manual* claim with a stated
   window.
2. **Wrong amount.** Never auto-match, even for a rounding difference. The fee is
   fixed; anything that is not exactly right is an exception for a human.
3. **Third-party payer.** Match on reference, ignore the name. The name is a weak
   signal — Nigerian bank data mangles names ("ADA CHUKWUEMEKA", "A. CHUKWUEMEKA",
   "CHUKWUEMEKA ADA", "CHUKWUEMAKA") and matching on it will produce false
   negatives that look like non-payment to the applicant.
4. **Double payment.** This one must be *prevented*, not resolved: a second
   transfer with the same reference, amount and date must raise an immediate
   warning on the status page ("we have already received a payment against this
   reference") rather than create a second allocation.
5. **Orphaned credits older than the claim window.** A written policy is needed.
   Suggested: 90 days, then the credit is returned to the payer where the bank
   allows it, and where it does not, it is written off to a suspense account and
   disclosed in the period close. A suspense account with an ageing report is not
   optional — it is how you find out that money is sitting unclaimed.

### 5.4 There is no refund path

Payment happens *after* approval, so refunds should be rare. They are not
impossible:

- the Department approves, the student pays, and the approval is then **withdrawn**
  (clause 10 of the Terms);
- an entry is **suspended** and policy says money is returned;
- the student **overpays**.

The document must say who refunds and how the platform records it. Because the
money sits in NMU's account, **NMU refunds** — but the platform needs a way to
express it, and the applicant needs a way to see it. The ledger needs a negative
allocation row, or a symmetric `fee_refunds` table. Right now there is no way to
say "we took ₦200 and gave it back".

### 5.5 Two reconciliations are conflated

The document uses "reconciliation" for at least two different things. They have
different cadences, different owners and different failure modes, and conflating
them is how a finance system ends up with one number nobody trusts.

| | **Daily bank reconciliation** | **Institutional split reconciliation** |
| --- | --- | --- |
| Question | Did the credits we recorded match the bank's statement? | Does the split hold, and has each side been settled? |
| Cadence | Daily, once the statement lands | Weekly (settlement) and monthly (signed) |
| Owner | Media Unit finance officer | Media Unit finance officer + NMU central finance, countersigned by Voeq |
| Source of truth | The bank's statement file | The statement + the remittance advice + our receivable ledger |
| Failure looks like | An unmatched credit or a missing fee | The school share not swept, or the Voeq share not remitted |

They must be separate, separately reported jobs with separate audit entries. The
second one is the one that actually protects the business, and it is the one the
supplied document mentions least.

### 5.6 No rate versioning

The document uses ₦200 throughout. If the fee changes — and it will — then:

- entries confirmed before the change must keep the old rate;
- the receivable ledger must not silently restate history;
- the fee shown on a status page issued last month must still be the fee that
  applies to that entry.

Fix: the rate lives in a **versioned `fee_schedule`** table with effective dates,
and every `fee_intent` snapshots the rate it was created under. Do not read the
rate from a mutable config row at confirmation time. Cheap now, expensive to
retrofit.

### 5.7 Volume does not justify nine tables on day one

The supplied document's payment core names nine tables. At NMU's scale — 184
applications and 96 registrations in the pilot year — that is a lot of schema to
get right before a single real payment lands.

**Phase 1 — five tables:**

| Table | Replaces |
| --- | --- |
| `fee_intents` | `payment_intents` — what is owed, to whom, at which rate, and its split |
| `bank_credits` | `bank_credit_events` — what the bank said, imported from the feed |
| `fee_payments` | `payments` — a confirmed allocation of credits to an intent |
| `fee_allocations` | `fee_receipts` + `fee_receipt_allocations` — the ₦5,000 / ₦200 split, FIFO |
| `audit_log` | `audit_logs` — hash-chained, per-entity |

Defer `payment_evidence_links` (make evidence a plain typed reference column on
`fee_intents` until polymorphic linking is actually needed) and defer
`exceptions` (make it a status plus a view until the exception workflow is used).

The double-entry, the split and the audit chain do not depend on the table count.
Keep those.

### 5.8 The school's own share is not our problem to solve — but it is our problem to *see*

The school share (₦5,000 per registration) is NMU's money and NMU's accounting
problem. Our obligation is narrow: prove that each credit was divided the way
the arrangement says, and report both balances so nobody has to reconstruct it
from a bank portal by hand.

The temptation is to build NMU's whole fee-collection accounting. Don't. Build the
split allocation and the memorandum balance, and let the split reconciliation be a
**shared document** both sides sign. If NMU central finance wants its own
collection system, that is their project.

---

## 6. Changes I would make to the supplied architecture

### 6.1 Keep

No custody. The invariant. Double-entry with a memorandum side. Screenshots never
being confirmation. Maker-checker on fee confirmation. The gate battery. The
blocking final close.

### 6.2 Change

**6.2.1 Chain the audit log per entity, not globally.** A single global chain
serialises every write — it becomes a write bottleneck, and one bad row makes the
rest of the chain unverifiable. A per-application or per-ledger-entry chain is
still tamper-evident for the thing that matters without the contention.

**6.2.2 Collapse nine tables into five for phase 1.** §5.7.

**6.2.3 Version the fee rate.** §5.6.

**6.2.4 Separate the two reconciliations.** §5.5.

**6.2.5 Make the bank feed pluggable.** §5.1.

**6.2.6 Scope maker-checker to two actions.** §4.5.

**6.2.7 Split the money at the account, in our ledger, as an allocation.** The
supplied architecture treated the ₦200 as a payment Voeq receives. In the model
Kai confirmed, the ₦200 is an **allocation within a credit that lands in NMU's
account**. Our ledger must therefore record two allocation lines per credit —
one to the school (memorandum) and one to Voeq (revenue) — not one payment
record. This is the single biggest modelling change, and it makes the split
provable instead of inferred.

### 6.3 Keep, but make configurable

- The remittance and sweep cadences.
- The claim window for unmatched credits (suggest 90 days).
- The fee rate, by effective date.
- The stop-rule threshold and who can trigger it (§7).

---

## 7. The business risk underneath the ledger

The model is correct, but it contains a risk the document does not name:

> **Voeq's revenue is not collected from students. It is collected from the
> Department, in arrears, at Voeq's discretion about when to ask.**

At ₦200 per registration and 96 registrations, the receivable at pilot-year end is
**₦19,200** — roughly a full quarter of platform revenue sitting in the hands of
an institution whose primary job is media, not accounts receivable.

This is not a reason to change the architecture. It is a reason for three controls:

1. **A written settlement schedule** (§3) — a named officer on both sides, and a
   remittance advice that says which registration references the payment settles.
2. **A receivable ageing report** on the register desk, not just a total. Buckets:
   current, 1–30 days, 31–60, 60+.
3. **A stop rule.** If the receivable exceeds an agreed threshold (say, two months
   of platform revenue), new registrations pause until it clears. Kai should
   decide the threshold and who may trigger it. It is uncomfortable, and much
   less uncomfortable than being owed ₦19,200 with no lever.

**And the reason this section exists.** Under a per-student platform fee the
Department collects on our behalf, the Department's incentive to remit promptly is
weak — the ₦200 is buried inside a fee it is already collecting for itself. That
is worth raising with the Department as a question: would a **flat institutional
fee**, invoiced to the University, invoiced per semester, be preferable? It turns a
cash-timing problem into an invoice and removes the orphaned-credit and
double-payment risks from the applicant's experience entirely.

---

## 8. Open questions

> **Status after Kai's answers, 15 Nov 2026 (evening):** Q-P1, Q-P2, Q-P5,
> Q-P6 and Q-P8 are **decided**. Q-P3 and Q-P4 are pending — a single
> onboarding list has been sent to the school's Media Unit (see §8.1).

| # | Question | Status | Decision |
| --- | --- | --- | --- |
| **Q-P1** | Settlement schedule | **Decided** | Weekly sweep + weekly remittance + monthly reconciliation. Signing is a **logged check/agreeance** tracked in the audit chain — not a rigorous manual signature ceremony. |
| **Q-P2** | ₦200 in writing | **Decided** | The fee is as read in the document. No versioning concern — any change comes back to Kai here and is worked through deliberately. The `fee_schedule` table still snapshots rates per intent (costs nothing, protects history). |
| **Q-P3** | Formal titles | **Pending** — details requested from the Media Unit (§8.1) |
| **Q-P4** | Bank & account details | **Pending** — same request (§8.1) |
| **Q-P5** | Refunds | **Decided** | No refund policy exists at the school; refunds are expected to be rare. Build **mitigation only**: the ledger carries a negative-allocation row so a refund *can* be recorded and seen, but no refund workflow UI is built now. Edge-case ready. |
| **Q-P6** | Orphaned credits & admin separation | **Decided** | Orphaned credits sit under **Media Unit roles**. Two mutually exclusive admin families (platform vs register) per §4.6, role-based not person-bound, every action logged, logs never deletable. Money-touching actions show a review screen before executing. **Every exception emails the applicant via Resend with the exact concern** — the email must never lie about what happened. |
| **Q-P7** | Read-only bank access | Unchanged — later optimisation |
| **Q-P8** | Ledger granularity | **Decided** | Per-registration ledger, built **simple to read**: one row per credit with its ₦5,000/₦200 division, plain-language statuses, totals at top — the UX bar is "the finance officer understands it without training." |

### 8.1 What we ask the school's Media Unit for (Q-P3 + Q-P4, one list)

1. **Bank name and branch** the dedicated account is held at.
2. **Account name** — exact, as it appears on the statement.
3. **Account number** of the dedicated registration account.
4. **Account type** — must be **current**, not savings, for a collection account.
5. **Bank code** (NIBSS/sort) — needed on the remittance advice (why: §4.8).
6. **Proof the account is NMU's** — a bank letter or statement header showing
   the account name is the University, not an individual (this is the custody
   proof, not a formality).
7. **Statement routine** — who exports the daily CSV, to which email address,
   and at what time (proposed: nightly by 23:00) (why: §4.8).
8. **Formal title of the reviewing authority** — the exact official name for
   the Terms, certificates and correspondence (also fixes the spec's title
   page, which still says the wrong university).
9. **Formal title of the account operator** and **who at central finance**
   sweeps the school share and executes the remittance (name + title for the
   reconciliation record).
10. **Support email and phone number** the Media Unit will answer applicants
    from — these go on the status page and in every email footer.
11. **Portal credentials holder** — who can log into the bank portal to export
    statements (used for handover documentation only; Voeq never holds them).

---

## 9. What I would build first

In order, assuming Q-P1 and Q-P4 are answered:

1. **The feed.** CSV importer → normalised `bank_credits`, with the statement file
   hashed and stored as evidence. Everything downstream depends on this and nothing
   else does.
2. **The ledger.** `fee_intents`, `fee_payments`, `fee_allocations`, double-entry
   with the ₦5,000 / ₦200 split, per-entity hash chain. With a fixture-based test
   suite that replays a month of a real statement.
3. **The gate battery.** Every transition in §4.5 as an explicit, tested predicate.
4. **The matching and allocation engine.** Reference-first, exact-amount-only, FIFO,
   with the split written on every allocation, plus exceptions and a manual claim
   path. Test it against a month of deliberately messy data: wrong references, split
   payments, double payments, third-party payers.
5. **The two balances.** The school share held, and the Voeq share receivable, with
   ageing. This is the screen the Media Unit works from every morning.
6. **The maker-checker and the two confirmations.**
7. **The settlement jobs and the period close**, including the statement hash.
8. **The stop rule**, once Q-P1 and Q-P2 are answered.

Not first, and deliberately: the payment UI polish, the fee schedule admin, the
refund path, the suspense ageing report. They matter, but they are downstream of a
ledger that is correct, and a ledger that is correct is the whole job.
