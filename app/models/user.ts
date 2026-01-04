import { z } from "zod";
import { schema as citySchema } from "./cities";

export const schema = z.object({
    _type: z.literal('user'),
    id: z.string(),
    fullName: z.string(),
    email: z.string(),
    avatarUrl: z.string().optional(),
    adminCities: z.array(citySchema).default([])
})

export type User = z.infer<typeof schema>