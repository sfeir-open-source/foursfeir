import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, json, useParams } from "@remix-run/react";
import cx from "classnames";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { CalendarDay } from "~/components/CalendarDay";

import { authenticator, getUserFromRequest } from "~/services/auth.server";
import invariant from "~/services/validation.utils.server";
import { Temporal } from "temporal-polyfill";
import { bookingService, cityService, profileService } from "~/services/application/services.server";
import { Booking, IndexedBooking } from "~/services/domain/booking.interface";
import { getOccupancy } from "~/services/domain/booking.interface";
import { getRequestPeriod, getAllDatesFromPeriod } from "~/services/domain/booking.interface";
import { emailToFoursfeirId, Profile } from "~/services/domain/profile.interface";
import { isNotice, splitCities } from "~/services/domain/city.interface";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.city, "No city given");
  const user = await getUserFromRequest(request);

  const { main, additional } = splitCities(params.city);
  const city = await cityService.getCity(main);
  const additionalCities = await cityService.getCities().then((cities) => cities.filter((c) => additional.includes(c.slug)));

  const search = new URL(request.url).searchParams;
  const [start, end] = getRequestPeriod(
    search.get("from") != null
      ? Temporal.PlainDate.from(search.get("from")!)
      : Temporal.Now.plainDateISO(),
    Number(search.get("weeks") ?? 2),
  );

  const [periodBookings, notices, ...additionalPeriodBookings] = await Promise.all([
    bookingService.getBookingsRange(city.slug, start, end),
    cityService.getNotices(city.slug, { after: start, before: end }),
    ...additionalCities.map((c) => bookingService.getBookingsRange(c.slug, start, end)),
  ]);

  const bookingsDailies: IndexedBooking[] = [
    ...periodBookings
      .reduce((previous, booking) => {
        previous.set(
          booking.date,
          (previous.get(booking.date) ?? []).concat({
            index: (previous.get(booking.date)?.length ?? 0) + 1,
            ...booking,
          }),
        );
        return previous;
      }, new Map())
      .values(),
  ];

  const additionalBookingsDailies: Booking[] = additionalPeriodBookings.flat().toSorted((a, b) => a.date.toString().localeCompare(b.date.toString()));


  const days = getAllDatesFromPeriod([start, end]);
  const occupancies = days.map((day) =>
    getOccupancy(bookingsDailies.flat().filter(({ date }) => date === day)),
  );

  const sortedByDayWithProfile: (IndexedBooking & { profile: Profile })[] =
    await Promise.all(
      bookingsDailies.flat().map(async (booking) => {
        const profile = await profileService.loader.load(booking.user_id);
        return { ...booking, profile: profile! };
      }),
    );

  const additionalSortedByDayWithProfile: (Booking & { profile: Profile })[] =
    await Promise.all(
      additionalBookingsDailies.map(async (booking) => {
        const profile = await profileService.loader.load(booking.user_id);
        return { ...booking, profile: profile! };
      }),
    );

  return json({
    city,
    additionalCities,
    days,
    occupancies,
    bookings: sortedByDayWithProfile ?? [],
    additionalBookings: additionalSortedByDayWithProfile ?? [],
    capacity: city.capacity,
    maxCapacity: city.max_capacity,
    notices: notices.filter(isNotice) ?? [],
    user,
  });
};


export default function Current() {
  const { city: combinedSlug } = useParams();
  const { city, additionalCities, days, occupancies, bookings, additionalBookings, notices, capacity, maxCapacity, user } =
    useLoaderData<typeof loader>();

  return (
    <>
      <h1> Réservations à {city.label} {additionalCities.length > 0 ? `et ${additionalCities.map((c) => c.label).join(", ")}` : ""}</h1>
      {days.map((day, i) => {
        const dayBookings = bookings.filter(({ date }) => date === day);
        const additionalDayBookings = additionalBookings.filter(({ date }) => date === day);
        const notice = notices.find((n) => n.date === day);
        const date = Temporal.PlainDate.from(day);
        return (
          <CalendarDay
            key={day}
            occupancy={occupancies[i]}
            className={cx({
              "calendar-day--end-of-week": date.dayOfWeek === 5,
            })}
            date={date}
            notice={notice?.message}
            bookings={dayBookings}
            additionalBookings={additionalDayBookings}
            userId={user!.user_id}
            combinedSlug={combinedSlug!}
            city={city.slug}
            capacity={notice?.temp_capacity ?? capacity}
            maxCapacity={notice?.temp_capacity ?? maxCapacity}
          />
        );
      })}

      <Form className="calendar-day" method="get" action={`/${combinedSlug}/redirect`}>
        <fieldset role="group">
          <input type="date" name="date" />
          <button type="submit">Go</button>
        </fieldset>
      </Form>
    </>
  );
}
