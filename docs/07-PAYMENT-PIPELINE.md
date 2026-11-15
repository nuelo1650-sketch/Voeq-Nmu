# 07 — Payment Pipeline

> **Status:** assessment of the school-owned-account architecture, adapted to NMU.
> Written 15 Nov 2026.
>
> This document takes the payment architecture Kai supplied (school-owned bank account,
> direct student transfers, no provider, no virtual accounts, no custody by Voeq), adapts
> it to Nigeria Maritime University, and then says plainly where I think it is right,
> where it is incomplete, and where I would change it.
>
> **Read §2 and §3 first.** §2 is the one thing that has to be confirmed with the Media
> Department before any code is written, and §3 is the set of gaps the supplied document
> does not cover.

---

## 1. What the supplied architecture gets right

These are not hedges. They are correct, and I would not change them.

**1.1 No custody is the correct call.** If Voeq never holds the student's money, then Voeq
is not a payment service provider. No licensing, no trust account, no segregation of client
funds, no PCI scope beyond whatever the receipt upload touches, and no chargeback exposure.
The operational surface shrinks to "a ledger that is right", which is a problem a good
engineer can actually solve. Custody would have been a licence to operate a small bank.

**1.2 The core invariant is the right one.** `revenue = ₦200 × confirmed registrations`
states the thing that must always be true, and it is stated in terms of *confirmed
registrations* rather than *money received*. That distinction is the whole design. It
survives a late payment, a partial remittance from the school, and a reconciliation
dispute, because it never depends on cash having moved in a particular order.

**1.3 Receivable mode, not custody mode, is correctly named.** A double-entry ledger with
`Dr receivable:from_school / Cr revenue:platform_fee` and memorandum tracking of
school-collected totals is the right accounting shape for money you are owed rather than
money you hold. The memorandum side (school-collected total) keeps the school honest without
pretending it is our money.

**1.4 A student's screenshot is never the source of truth.** Correct, and it is the rule
most likely to be quietly broken by a well-meaning staff member under time pressure. It
needs to be enforced in the schema — a `payment` cannot be created without a
`bank_credit_event` behind it — not just in a policy document.

**1.5 Maker-checker on fee confirmation.** Correct. The person who enters the bank statement
and the person who confirms the fee must be different people. This is the control that stops
one person manufacturing revenue.

**1.6 Hash-chained audit log.** Correct instinct. See §5.4 for the one change I would make.

**1.7 A blocking final close.** Correct. A period that cannot be closed until every credit
in it is matched, allocated or excepted is the only way the ledger stays true.

**1.8 Gate battery.** Correct. Every state transition should be gated by an explicit
predicate rather than by a code path that happens to work.

---

## 2. The one thing that must be confirmed before we build

The supplied architecture says:

> Voeq only *tracks, verifies, reconciles, and records* the school's manual payment of the
> ₦200 fee.

That sentence is doing a lot of work and it admits two readings.

### Reading A — one transfer, split remitted by the school

The student transfers **₦5,200** (₦5,000 registration fee + ₦200 platform fee) to the
University's account in a single payment, quoting `NMU-2026-XXXX` as the reference. The
Media Department then remits Voeq's ₦200 share, on a weekly or monthly cadence.

- Voeq's receivable: `₦200 × confirmed registrations`, settled in arrears by the school.
- Voeq receives no money from students at all.
- The student deals with exactly one account and one reference.

### Reading B — the student pays the school only; the school pays Voeq separately

The student transfers **₦5,000** to the University. The Media Department pays the ₦200
platform fee to Voeq on the student's behalf, out of the same funds.

- Voeq's receivable: still `₦200 × confirmed registrations`, still settled in arrears.
- The student is asked for ₦5,000, and the ₦200 is a separate inter-party transfer the
  student never sees.

### Why this is the critical question

It is not a cosmetic difference. It changes:

| | Reading A | Reading B |
| --- | --- | --- |
| What the applicant is told to pay | ₦5,200 | ₦5,000 |
| Where the applicant is told to pay | University account | University account |
| Does the applicant see the split at all? | Yes, on their status page | No |
| Who is our counterparty for the ₦200? | The Department | The Department |
| Does Voeq ever appear on a bank statement? | Never | Yes, as a payee |
| Does the "platform fee" survive as a *fee to the applicant*? | Yes | No — it becomes a wholesale arrangement |

Reading B is the more faithful reading of the words *"the school's manual payment of the
₦200 fee"* — it is the **school** paying the fee. But Reading A is simpler for the student
and is what the current prototype models.

**There is a third possibility the document does not mention, and it is worth putting on the
table:** the Department may not want to collect a platform fee at all, and may prefer a flat
annual arrangement with Voeq — for example a fixed retainer per semester for maintaining the
register, invoiced to the University, with no per-student platform fee at all. Under that
model the whole `₦200 × registrations` invariant changes shape, and it changes from a
transactional revenue model to a subscription model. It would be simpler for everybody,
including the Department, and it removes the entire cash-timing risk in §4.1.

**My recommendation:** model the ledger so that the *rate* is a versioned configuration
value rather than a constant (§5.3), and so that the pipeline works whether the fee is
collected as a per-registration platform fee or recognised as a periodic institutional
fee. Build the ledger; do not hardcode the commercial arrangement into it. Then go and get
the answer from the Department.

---

## 3. Gaps in the supplied architecture

These are the things the document does not cover that will bite us.

### 3.1 The bank-evidence feed — the real critical path

The document ends with its own question:

> how will the school give you the bank evidence — a daily statement CSV export, bank
> alerts forwarded to a finance officer, or read-only statement access?

This is the right question to be asking, and it is the last real variable. My answer:

**Use a daily statement CSV as the source of truth. Use bank alerts only as a same-day
accelerator. Treat read-only access as a later optimisation.**

| Feed | Verdict |
| --- | --- |
| **Daily statement CSV** | **Primary.** Manual, but complete, auditable, and hashable. A Media Department officer with bank portal access can export one in under a minute. It gives us a file we can store and hash as evidence, which is exactly what an audit needs. It needs no bank relationship, no API contract, no security review at the bank. |
| **Bank alerts** | **Accelerator only, never the source of truth.** Alerts are a push notification, not a statement — they get missed, they get muted, and in several Nigerian bank formats the counterparty name is truncated or absent. Use them to surface "a credit landed an hour ago" so finance can pre-stage the match. Do not let them create a `bank_credit_event` on their own. |
| **Read-only statement access** | **Best, slowest.** If the University has API or open-banking access to its Zenith account, that is the ideal feed. It will take months to arrange and adds a third party to the critical path. Build for it, do not wait for it. |

The architectural requirement that follows: **the ingestion source must be pluggable from
day one.** Model the feed as an interface — `BankFeed.fetch(day) → normalised credits[]` —
with a CSV implementation first and a future API implementation behind the same contract.
The matching, allocation and ledger code must never know where the credits came from. If we
hardcode "read the CSV", we will rewrite it later.

### 3.2 The waiting state is not specified, and the applicant will feel it

The document is written from the ledger's point of view. It does not say what the student
sees between "I paid" and "confirmed". Under a CSV feed, the student's money is in the
University's account but our ledger does not know about it until the next statement arrives.

This needs an explicit state, with its own message and its own SLA:

```
submitted → awaiting_bank_evidence → matched → confirmed
```

And the applicant-facing copy must say something true and specific, e.g.:

> We have your receipt. The University's bank record reaches us once a day at 23:00. We
> confirm your entry on the next working day. Your reference is NMU-2026-0042.

Do not say "we'll email you when it's confirmed" and then go quiet for two days. That is
the single most likely source of "I paid and nobody called me" complaints, and it is the
complaint that costs the Department goodwill with the students it depends on.

### 3.3 Orphaned credits are not handled

The document covers matching, dedupe and exceptions, but not the case that actually generates
cash-handling work: **a credit arrives that belongs to nobody we can identify.**

Common causes:

- the student paid with a **wrong or missing reference**;
- the student paid the **wrong amount** (₦5,150, or ₦5,000 under Reading A);
- a third party paid on the student's behalf, so the payee name does not match;
- a **double payment** — the student paid again because the first was not confirmed.

We need a defined path for each:

1. **Wrong reference, right amount, right payee name.** Recoverable by matching on
   payee name + amount + date window. Must be a *manual* claim with a stated window.
2. **Wrong amount.** Never auto-match, even for a rounding difference. The fee is fixed;
   anything that is not exactly right is an exception for a human.
3. **Third-party payer.** Match on reference, ignore the name. The name is a weak signal —
   Nigerian bank data mangles names ("ADA CHUKWUEMEKA", "A. CHUKWUEMEKA", "CHUKWUEMEKA ADA",
   "CHUKWUEMAKA") and matching on it will produce false negatives that look like
   non-payment to the applicant.
4. **Double payment.** This one must be *prevented*, not resolved: a second transfer with the
   same reference, amount and date must raise an immediate warning on the status page
   ("we have already received a payment against this reference") rather than create a second
   receivable.
5. **Orphaned credits older than the claim window.** Need a written policy. Suggested:
   90 days, then the credit is returned to the payer where the bank allows it, and where it
   does not, it is written off to a suspense account and disclosed in the period close. A
   suspense account with an ageing report is not optional — it is how you find out that the
   Department is sitting on unclaimed student money.

### 3.4 There is no refund path

Under the current flow, payment only happens *after* approval, so refunds should be rare.
They are not impossible:

- the Department approves, the student pays, and the approval is then **withdrawn** (clause 10
  of the Terms);
- the entry is **suspended** for a non-payment reason and the Department's policy says
  money is returned;
- the student **overpays**.

The document must say who refunds — in both readings that is the **Department**, because the
Department holds the money — and how the platform records it. The ledger needs a
`fee_receipt_allocations` row with a negative allocation, or a symmetric `fee_refunds`
table. Right now there is no way to express "we took ₦200 and gave it back".

### 3.5 Two reconciliations are conflated

The document uses "reconciliation" for at least two different things. They have different
cadences, different owners and different failure modes, and conflating them is how a
finance system ends up with one number that nobody trusts.

| | **Daily bank reconciliation** | **Institutional fee reconciliation** |
| --- | --- | --- |
| Question | Did the credits we recorded match the bank's statement? | Has the Department remitted what it owes us? |
| Cadence | Daily, once the statement lands | Weekly or monthly, per the remittance schedule |
| Owner | Voeq finance ops | Voeq finance + the Department's finance officer |
| Source of truth | The bank's statement file | The remittance advice + our receivable ledger |
| Failure looks like | An unmatched credit or a missing fee | The receivable ageing past its SLA |

They must be separate, separately reported jobs with separate audit entries. The second one
is the one that actually protects the business, and it is the one the supplied document
mentions least.

### 3.6 No rate versioning

The document uses ₦200 throughout. If the Department changes the fee — and it will, at some
point — then:

- entries confirmed before the change must keep the old rate;
- the receivable ledger must not silently restate history;
- the fee shown on a status page issued last month must still be the fee that applies to
  that entry.

Fix: the rate lives in a **versioned `fee_schedule`** table with effective dates, and every
`fee_intent` snapshots the rate it was created under. Do not read the rate from a mutable
config row at confirmation time. This is cheap to do now and expensive to retrofit.

### 3.7 Volume does not justify nine tables on day one

The document's payment core names nine tables. At NMU's scale — 184 applications and 96
registrations in the pilot year — that is a lot of schema to get right before a single real
payment lands.

**Phase 1 — five tables:**

| Table | Replaces |
| --- | --- |
| `fee_intents` | `payment_intents` — what is owed, to whom, at which rate |
| `bank_credits` | `bank_credit_events` — what the bank said, imported from the feed |
| `fee_payments` | `payments` — a confirmed allocation of credits to an intent |
| `fee_allocations` | `fee_receipts` + `fee_receipt_allocations` — FIFO allocation of credits to intents |
| `audit_log` | `audit_logs` — hash-chained, per-entity |

Defer `payment_evidence_links` (make evidence a plain typed reference column on
`fee_intents` until you need polymorphic linking), and defer `exceptions` (make it a status
plus a `exceptions` view until the exception workflow is actually used).

The double-entry and the audit chain do not depend on the table count. Keep those.

---

## 4. The NMU adaptation

### 4.1 The commercial reality underneath the ledger

The model is correct, but it contains a business risk the document does not name:

> **Voeq's revenue is not collected from students. It is collected from the Department, in
> arrears, at Voeq's discretion about when to ask.**

At ₦200 per registration and 96 registrations, the receivable at pilot-year end is
**₦19,200** — roughly a full quarter of platform revenue sitting in the hands of an
institution whose primary job is media, not accounts receivable.

This is not a reason to change the architecture. It is a reason to add three controls:

1. **A written remittance schedule** — weekly or fortnightly, with a named officer on both
   sides, and a remittance advice that says which registration references the payment
   settles.
2. **A receivable ageing report** on the register desk, not just a total. Age buckets:
   current, 1–30 days, 31–60, 60+. The dashboard already has a place for this (§4.4).
3. **A stop rule.** If the receivable exceeds an agreed threshold (say, two months of
   platform revenue), the Department is told that new registrations pause until it clears.
   Kai should decide this threshold and who is allowed to trigger it. It is uncomfortable,
   and it is much less uncomfortable than being owed ₦19,200 with no lever.

**And the reason this whole section exists:** consider the alternative. Under Reading B —
where the student pays ₦5,000 and the Department pays us — the Department's commercial
incentive to remit promptly is weak, because the ₦200 is buried inside a fee it is already
collecting for itself. A per-student platform fee that the Department collects on our behalf
and does not feel strongly about is a per-student platform fee we will collect late.

**That is the strongest argument for the third possibility in §2** — a flat institutional fee
paid by the Department directly, invoiced, with no per-student collection at all. It turns a
cash-timing problem into an invoice. If the Department will take that deal, take it.

### 4.2 Actors and roles

| Role | Who | Can do |
| --- | --- | --- |
| Applicant | Student or staff | Submit an application, see their own status page, upload a receipt, claim an unmatched payment |
| Media officer | NMU Media Unit | Assess applications, request corrections, approve, reject |
| Finance officer | NMU Media Unit or University finance | Import the statement, stage matches, **not** confirm |
| Confirming officer | NMU Media Unit or University finance (a second person) | Confirm a matched fee, reject a receipt |
| Platform admin | Voeq | Manage the fee schedule, open and close periods, grant roles |
| Read-only auditor | Voeq / University audit | Read the ledger and the audit chain; cannot write |

**Maker-checker applies to exactly two actions** in phase 1: *confirming a fee* and *writing
off an exception*. Everything else (importing a statement, staging a match, correcting a
draft) is single-officer. Over-applying maker-checker makes the process slow enough that
people route around it, which is worse than not having it.

### 4.3 The pipeline, end to end

```
        STUDENT                VOEQ                       THE UNIVERSITY
           │                    │                              │
  ① apply │                    │                              │
           ├──▶ entry approved ──────────────────────────────▶ │
           │                    │                              │
  ② pay   │                    │                    bank ◀─────┤ student transfers
           │                    │                              │    directly to the
           │                    │                              │    University account
           │                    │                              │
  ③ receipt upload             │                              │
           ├──▶ evidence linked │                              │
           │                    │                              │
           │                    │◀──── statement CSV ──────────┤ 23:00 daily
           │                    │                              │
  ④ ingest + match             │                              │
           │                    │  credits → intents (FIFO)    │
           │                    │                              │
  ⑤ maker: stage the match     │                              │
  ⑥ checker: confirm ──────────┼─────────────────────────────▶ │
           │                    │                              │
  ⑦ register + list           │  receivable +200              │
           │                    │                              │
  ⑧ periodic remittance ───────┼─────────────────────────────▶ │  ┌──────────────┐
           │                    │  receivable −200             │  │ Dept pays    │
           │                    │  revenue recognised          │  │ Voeq ₦200    │
           │                    │                              │  └──────────────┘
  ⑨ close the period           │  hash the statement           │
```

Step ⑦ is where the invariant is enforced: **the entry is listed, and revenue is
recognised, at the moment the fee is confirmed — not when the money is remitted.** Remittance
settles the receivable. It does not create the registration.

### 4.4 What this means for the register desk

Two things change in the staff UI, and they are already visible in the prototype:

1. **The receivable is on the dashboard as a first-class number** — "₦4,600.00 receivable
   from NMU · 23 registrations · last reconciled 2 days ago" — because the receivable is the
   thing that actually matters to the business, and the previous dashboard said nothing about
   it.
2. **Payment verification is a mode at the same level as the queue**, not a sub-card. It is a
   daily job with its own SLA, its own maker-checker, and its own failure mode (a mismatch
   between two things that both look right).

The prototype's fee ledger is already built this way — the same dark ledger header, a
one-figure dominant count, and a receivable strip.

### 4.5 State machine

| State | Meaning | Who moves it |
| --- | --- | --- |
| `not_required` | Entry not approved | system |
| `required` | Approved, awaiting the student's transfer | system, on approval |
| `evidence_submitted` | Receipt uploaded, awaiting the bank record | applicant |
| `awaiting_bank_evidence` | Ingested into the statement, not yet matched | system |
| `matched` | Credit identified, staged by the maker | system, on ingest |
| `confirmed` | Checker approved the match | checker |
| `rejected` | Receipt not acceptable; applicant may resubmit | checker |
| `exception` | Match failed; human review required | maker, then checker |
| `written_off` | Credit cannot be applied; suspense or refund | checker |
| `refunded` | Allocation reversed | checker |

Guard rules:
- `required → evidence_submitted` requires an uploaded receipt with amount, date and reference.
- `matched → confirmed` requires a `bank_credit_event` id, a maker id and a checker id, and
  the checker must differ from the maker.
- `confirmed` is terminal for that intent. Re-entry after confirmation is a refund
  (§3.4), never a second confirmation.
- `exception → anything` requires a resolution note.

---

## 5. Changes I would make to the supplied architecture

### 5.1 Keep

Agency/receivable mode. The invariant. Double-entry with a memorandum side. Screenshots are
not confirmation. Maker-checker on fee confirmation. The gate battery. The blocking final
close.

### 5.2 Change

**5.2.1 Chain the audit log per entity, not globally.** A single global chain serialises
every write in the system — it becomes a write bottleneck, and one bad row makes the rest
of the chain unverifiable. A per-application chain is still tamper-evident for the thing
that matters (nobody can quietly edit an application's history) without the contention.

**5.2.2 Collapse nine tables into five for phase 1.** §3.7.

**5.2.3 Version the fee rate.** §3.6.

**5.2.4 Separate the two reconciliations.** §3.5.

**5.2.5 Make the bank feed pluggable.** §3.1.

**5.2.6 Scope maker-checker to two actions.** §4.2.

### 5.3 Keep, but make configurable

- The remittance cadence (weekly / fortnightly / monthly).
- The claim window for unmatched credits (suggest 90 days).
- Whether the fee is a per-registration platform fee or a periodic institutional fee (§2).
- The stop rule threshold and who can trigger it (§4.1).

### 5.4 One more thing the document should have said

The document says the platform *records* the school's manual payment of the ₦200 fee. It
does not say **who is responsible if the school never pays it**, or **what the platform's
revenue actually is** if the school quietly stops remitting.

Under the supplied model, a Department that stops remitting still keeps collecting ₦200
from students. From the student's point of view they have paid the fee and been listed.
From Voeq's point of view we have a growing receivable and no leverage.

So: the platform needs to be able to *see* the receivable ageing in real time, escalate it,
and eventually pause new registrations. That is a business rule, not a technical one, and it
needs to be agreed with the Department in writing before launch — ideally in the same
document that agrees the remittance schedule.

---

## 6. Open questions

Ordered by how much damage an unanswered one does.

| # | Question | Owner | Blocks |
| --- | --- | --- | --- |
| **Q-P1** | Is the student asked for ₦5,200 in one transfer, or ₦5,000 with the Department paying the ₦200 separately? Or is it a flat institutional fee instead? | Media Department | The status page copy, the receivables model, the whole commercial arrangement |
| **Q-P2** | Which bank account exactly, in whose name, and who holds the bank portal credentials? | University finance | The feed implementation |
| **Q-P3** | What is the remittance cadence, and which officer on the Department's side signs it off? | Media Department | The receivable ageing report, the stop rule |
| **Q-P4** | Who refunds, in what timescale, and how is a refund recorded? | Media Department | The ledger's refund path |
| **Q-P5** | What happens to a credit that cannot be matched after 90 days? | Media Department + Voeq | The suspense account and its policy |
| **Q-P6** | Is the ₦200 fee itself agreed in writing, and for how long? | Kai + Media Department | The fee schedule table, the whole revenue model |
| **Q-P7** | Can the University give read-only statement access? | University finance | A later optimisation, not a blocker |
| **Q-P8** | Does the Department want a per-registration ledger at all, or only a monthly summary? | Media Department | Whether we build the allocation model or something much lighter |

---

## 7. What I would build first

In order, assuming Q-P1 and Q-P2 are answered:

1. **The feed.** CSV importer → normalised `bank_credits`, with the statement file hashed and
   stored as evidence. Everything downstream depends on this and nothing else does.
2. **The ledger.** `fee_intents`, `fee_payments`, `fee_allocations`, double-entry, per-entity
   hash chain. With a fixture-based test suite that replays a month of a real statement.
3. **The gate battery.** Every transition in §4.5 as an explicit, tested predicate.
4. **The matching engine.** Reference-first, exact-amount-only, FIFO allocation, with
   exceptions and a manual claim path. Test it against a month of deliberately messy data:
   wrong references, split payments, double payments, third-party payers.
5. **The maker-checker and the two confirmations.**
6. **The period close**, including the statement hash.
7. **The receivable report and the ageing view** — the thing that protects the business.
8. **The stop rule**, once Q-P3 and Q-P6 are answered.

Not first, and deliberately: the payment UI, the fee schedule admin, the refund path,
the suspense ageing report. They matter, but they are downstream of a ledger that is
correct, and a ledger that is correct is the whole job.
