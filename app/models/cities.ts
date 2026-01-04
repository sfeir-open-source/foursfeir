import { z } from "zod";

export const schema = z.object({
    _type: z.literal('city'),
    slug: z.string(),
    label: z.string(),
    capacity: z.number(),
    maxCapacity: z.number()
})

export type City = z.infer<typeof schema>