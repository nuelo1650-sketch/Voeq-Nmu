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
import { z } from "zod";

export const decisionSchema = z.object({
  applicationId: z.string().min(1),
  kind: z.enum(["approve", "request_corrections", "reject"]),
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
      input.kind === "approve" ? "approved" : input.kind === "reject" ? "rejected" : "needs_correction";
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
      | ReturnType<typeof correctionsRequested>;

    if (input.kind === "approve") {
      letter = applicationApproved(application.reference, application.businessName, paymentStepUrl);
    } else if (input.kind === "reject") {
      letter = applicationRejected(application.reference, input.reason!);
    } else {
      letter = correctionsRequested(application.reference, input.items!);
    }

    await tx.application.update({ where: { id: application.id }, data });

    await createNotification(tx, {
      topic: `application.${input.kind}`,
      payload: { to: application.contactEmail, template: letter },
    });

    return { reference: application.reference, status: target };
  });
}
