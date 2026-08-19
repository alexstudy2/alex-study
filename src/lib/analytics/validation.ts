import { z } from "zod";

export const analyticsQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  /* The range picker sends a day count and lets the server resolve the boundary, because the
     boundary has to land on a Cairo midnight and the browser does not know where that is. `from`
     and `to` stay supported for callers that genuinely have two instants. `coerce` because it
     arrives as a query-string digit. */
  days: z.coerce.number().int().min(1).max(365).optional(),
  subjectId: z.string().uuid().optional(),
});
