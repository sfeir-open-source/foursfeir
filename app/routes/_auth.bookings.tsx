import { ActionFunctionArgs } from "@remix-run/node";
import { Temporal } from "temporal-polyfill";
import z from "zod";
import { zfd } from "zod-form-data";
import { adminService, bookingService, profileService } from "~/services/application/services.server";
import { getUserFromRequest } from "~/services/auth.server";
import { emailToFoursfeirId } from "~/services/domain/profile.interface";

const schema = zfd.formData(
  z.discriminatedUnion("_action", [
    z.object({
      _action: z.literal("book"),
      city: zfd.text(z.string()),
      date: zfd.text(z.string().date().transform((d) => Temporal.PlainDate.from(d))),
      period: zfd.text(z.enum(["day", "morning", "afternoon"])),
      guests: z.object({
        day: zfd.numeric(z.number().int().min(0).max(10)).optional(),
        morning: zfd.numeric(z.number().int().min(0).max(10)).optional(),
        afternoon: zfd.numeric(z.number().int().min(0).max(10)).optional(),
      }).optional(),
    }),
    z.object({
      _action: z.literal("book-for"),
      city: zfd.text(z.string()),
      date: zfd.text(z.string().date().transform((d) => Temporal.PlainDate.from(d))),
      period: zfd.text(z.enum(["day", "morning", "afternoon"])),
      for_user: z.object({
        id: zfd.text(z.string().uuid()).optional(),
        email: zfd.text(z.string().email()),
        full_name: zfd.text(z.string().min(2).max(100)),
      }),
    }),
    z.object({
      _action: z.literal("remove"),
      city: zfd.text(z.string()),
      date: zfd.text(z.string().date().transform((d) => Temporal.PlainDate.from(d))),
    }),
    z.object({
      _action: z.literal("admin-remove"),
      city: zfd.text(z.string()),
      date: zfd.text(z.string().date().transform((d) => Temporal.PlainDate.from(d))),
      user_id: zfd.text(z.string().uuid()),
    }),
  ]),
);

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await getUserFromRequest(request);
  const f = schema.parse(await request.formData());


  if (f._action === "book") {
    const profile = await profileService.getProfileById(user.user_id);

    if (!profile) {
      await profileService.createProfile({
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
      });
    }

    await bookingService.upsertBooking({
      city: f.city,
      date: f.date,
      user_id: user.user_id,
      period: f.period,
      guests: f.guests ?? {},
      booked_by: null,
      created_at: Temporal.Now.instant(),
    });

    return new Response(null, { status: 201 });
  }

  if (f._action === "book-for") {
    const otherId = f.for_user.id ?? emailToFoursfeirId(f.for_user.email);
    const other = await profileService.getProfileById(otherId);

    if (other == null) {
      await profileService.createProfile({
        user_id: otherId,
        email: f.for_user.email,
        full_name: f.for_user.full_name,
      });
    }

    await bookingService.upsertBooking({
      city: f.city,
      date: f.date,
      user_id: otherId,
      period: f.period,
      booked_by: user.user_id,
      guests: {},
      created_at: Temporal.Now.instant(),
    });

    return new Response(null, { status: 201 });
  }

  if (f._action === "remove") {
    await bookingService.deleteBooking({
      city: f.city,
      user_id: user.user_id,
      date: f.date,
    });
    return new Response(null, { status: 204 });
  }

  const isAdmin = await adminService.isUserAdmin(user.user_id, f.city);
  if (isAdmin && f._action === "admin-remove") {
    await bookingService.deleteBooking({
      city: f.city,
      user_id: f.user_id,
      date: f.date,
    });
    return new Response(null, { status: 204 });
  }

  throw new Error(`Invalid action ${f._action}`);
};