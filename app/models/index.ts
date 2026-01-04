import { z } from "zod";
import { schema as userSchema } from "./user";
import { schema as citySchema } from "./cities";

const schema = z.discriminatedUnion('_type', [
    userSchema, citySchema
])
export type Schema = z.infer<typeof schema>