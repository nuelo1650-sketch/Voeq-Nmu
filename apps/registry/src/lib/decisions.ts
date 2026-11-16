// ---------------------------------------------------------------------------
// The decision engine — the only code path that changes an application's
// status in response to a staff member's judgement. Every transition goes
// through the state machine (packages/core); every decision writes a Decision
// row (immutable history) and queues the matching letter through the outbox,
// inside the SAME transaction (§19 invariant).
//
// Letters fired here: #2 corrections, #3 approved, #4 rejected.
// Maker-checker note: the fee-confirmation stage enforces approver ≠ checker;
// review decisions record the deciding account for the audit trail.
// ---------------------------------------------------------------------------

import { prisma } from "@voeq/db";
import { createNotification } from "@voeq/db/outbox";
import {
  applicationApproved,
  applicationRejected,
  correctionsRequested,
} from "@voeq/email";
import { assertApplicationTransition, type ApplicationStatus } from "@voeq/core";
import { mintAccessToken } from "@/lib/access";
import { writeAudit } from "@/lib/audit-write";
import { z } from "zod";

export const decisionSchema = z.object({
  applicationId: z.string().min(1),
  kind: z.enum([
    "approve",
    "request_corrections",
    "reject",
    "suspend",
    "lift_suspension",
    "close",
  ]),
  reason: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        field: z.string().trim().min(1).max(80),
        instruction: z.string().trim().min(1).max(400),
      }),
    )
    .max(10)
    .optional(),
});

export type DecisionInput = z.infer<typeof decisionSchema>;

/** The staff account a decision is attributed to. In production this is the
 *  verified Google email (doc 07 §4.7). */
export interface DecidingStaff {
  email: string;
  family: "platform" | "register";
}

export async function recordDecision(
  input: DecisionInput,
  staff: DecidingStaff,
): Promise<{ reference: string; status: ApplicationStatus }> {
  // Corrections and rejections REQUIRE written reasons — the email never
  // guesses, and neither do we (Q-P6 decision).
  if (input.kind === "reject" && !input.reason) {
    throw new Error("A rejection must carry a written reason");
  }
  if (input.kind === "request_corrections" && (!input.items || input.items.length === 0)) {
    throw new Error("A corrections request must list at least one concrete item");
  }
  // The badge only means something if it can be lost — losing it must be
  // written down (3.8/3.10). Lifting a suspension is the one lifecycle
  // action that needs no reason: the suspension's reason already exists.
  if ((input.kind === "suspend" || input.kind === "close") && !input.reason) {
    throw new Error(`A ${input.kind} decision must carry a written reason`);
  }

  return prisma.$transaction(async (tx) => {
    const application = await tx.application.findUniqueOrThrow({
      where: { id: input.applicationId },
      include: { revisions: { orderBy: { revisionNo: "desc" }, take: 1 } },
    });

    // Claim the review first: submitted → under_review is the "staff claims
    // the review" transition. Then the decision transition from under_review.
    let status = application.status as ApplicationStatus;
    if (status === "submitted") {
      assertApplicationTransition(status, "under_review");
      await tx.application.update({
        where: { id: application.id },
        data: { status: "under_review" },
      });
      status = "under_review";
    }

    const target: ApplicationStatus =
      input.kind === "approve"
        ? "approved"
        : input.kind === "reject"
          ? "rejected"
          : input.kind === "request_corrections"
            ? "needs_correction"
            : input.kind === "suspend"
              ? "suspended"
              : input.kind === "lift_suspension"
                ? "registered"
                : "closed";
    assertApplicationTransition(status, target);

    await tx.decision.create({
      data: {
        applicationId: application.id,
        revisionId: application.revisions[0]?.id ?? null,
        kind: input.kind,
        reason: input.reason ?? null,
        items: input.items ? input.items : undefined,
        decidedByEmail: staff.email,
      },
    });

    const now = new Date();
    const data: Parameters<typeof tx.application.update>[0]["data"] = {
      status: target,
      decidedAt: input.kind === "request_corrections" ? undefined : now,
    };

    // Letter #3 — approved carries the payment step (the fee is charged only
    // after approval, never before). The button opens the applicant's own
    // status page — payment card included — via a long-lived access token,
    // so no password and no separate request is needed (roadmap 1.5/1.15).
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const paymentStepUrl =
      input.kind === "approve"
        ? `${base}/track/${encodeURIComponent(application.reference)}/open?token=${mintAccessToken(
            application.id,
            application.contactEmail,
            "long",
          )}`
        : `${base}/track`;
    let letter:
      | ReturnType<typeof applicationApproved>
      | ReturnType<typeof applicationRejected>
      | ReturnType<typeof correctionsRequested>
      | undefined;

    if (input.kind === "approve") {
      // The fee intent IS the payment code: issued at approval, rate snapshotted
      // from the current fee schedule (doc 07 §5.6 — history never restates).
      // No intent → nothing to match, nothing confirmable (§2.6 rule 1).
      const schedule = await tx.feeSchedule.findFirst({
        where: { institutionId: application.institutionId },
        orderBy: { version: "desc" },
      });
      if (!schedule) throw new Error("No fee schedule configured for this institution");
      await tx.feeIntent.create({
        data: {
          applicationId: application.id,
          reference: application.reference,
          scheduleId: schedule.id,
          schoolMinor: schedule.schoolMinor,
          voeqMinor: schedule.voeqMinor,
          totalMinor: schedule.schoolMinor + schedule.voeqMinor,
        },
      });
      letter = applicationApproved(application.reference, application.businessName, paymentStepUrl);
    } else if (input.kind === "reject") {
      letter = applicationRejected(application.reference, input.reason!);
    } else if (input.kind === "request_corrections") {
      letter = correctionsRequested(application.reference, input.items!);
    }

    await tx.application.update({ where: { id: application.id }, data });

    // Letters fire for the applicant-facing decisions only. Suspend / lift /
    // close are register-side governance (3.10): the badge truth lives in
    // /api/public/verify and the applicant's status page — no letter pretends
    // a suspension is friendly news. If letters are wanted for them later,
    // they join the catalogue deliberately.
    if (input.kind === "approve") {
      await createNotification(tx, {
        topic: "application.approve",
        payload: {
          to: application.contactEmail,
          template: letter,
        },
      });
    } else if (input.kind === "reject") {
      await createNotification(tx, {
        topic: "application.reject",
        payload: {
          to: application.contactEmail,
          template: letter,
        },
      });
    } else if (input.kind === "request_corrections") {
      await createNotification(tx, {
        topic: "application.request_corrections",
        payload: {
          to: application.contactEmail,
          template: letter,
        },
      });
    }

    // The audit entry commits or dies with the decision it describes.
    await writeAudit(tx, {
      entityType: "Application",
      entityId: application.id,
      action: `application.${input.kind}`,
      actorEmail: staff.email,
      actorFamily: staff.family,
      data: {
        reference: application.reference,
        from: application.status,
        to: target,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.items ? { items: input.items } : {}),
      },
    });

    return { reference: application.reference, status: target };
  });
}
