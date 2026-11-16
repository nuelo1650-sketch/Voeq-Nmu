// The notes feature's shape — one schema, no drift between the two routes.

import { z } from "zod";

export const noteSchema = z.object({
  applicationId: z.string().min(1),
  body: z.string().trim().min(2).max(2000),
});

export type NoteInput = z.infer<typeof noteSchema>;
