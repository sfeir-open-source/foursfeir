import { ChangeEvent, Fragment, useState } from "react";
import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useFetcher,
  useLoaderData,
  useNavigation,
  useParams,
  useSearchParams,
} from "@remix-run/react";
import { RouteMatch } from "react-router";
import cx from "classnames";
import { zfd } from "zod-form-data";
import { z } from "zod";

import { FiUserMinus } from "react-icons/fi";
import Avatar from "~/components/Avatar";

import daily from "~/styles/daily.css?url";
import { getUserFromRequest } from "~/services/auth.server";
import {
  cityService,
  bookingService,
  profileService,
  adminService,
} from "~/services/application/services.server";
import {
  Period,
  isOverflowBooking,
  periods,
  groupBookings,
  indexBookings,
  getOccupancy,
} from "~/services/domain/booking.interface";
import invariant from "~/services/validation.utils.server";
import { emailToFoursfeirId } from "~/services/domain/profile.interface";
import { Temporal } from "temporal-polyfill";
import ProfileSearch from "~/components/ProfileSearch";
import type { Profile } from "~/services/domain/profile.interface";
import { Collator } from "~/services/collator.utils";
import { splitCities } from "~/services/domain/city.interface";



export const meta: MetaFunction<typeof loader> = ({ data, params }) => [
  { title: `FourSFEIR | ${data?.city.label} | ${params.date}` },
];

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  invariant(params.city, "No city given");
  invariant(params.date, "No date given");
  const date = Temporal.PlainDate.from(params.date);

  // Validate date format
  z.string().date().parse(params.date);

  const user = await getUserFromRequest(request);

  const { main, additional } = splitCities(params.city);

  const [city, notice, rawBookings, rawAdditionalBookingsies, admin] = await Promise.all([
    cityService.getCity(main),
    cityService.getNotice(main, date),
    bookingService.getBookings(main, date),
    Promise.all(additional.map((c) => bookingService.getBookings(c, date))),
    adminService.isUserAdmin(user.user_id, main),
  ]);

  const rawAdditionalBookings = rawAdditionalBookingsies.flat();

  const bookings = indexBookings(rawBookings);

  const profiles = await Promise.all(
    [...bookings, ...rawAdditionalBookings].map((b) => profileService.loader.load(b.user_id))
  );
  const occupancy = getOccupancy(bookings);
  const grouped = groupBookings(bookings);

  const additionalGrouped = groupBookings(rawAdditionalBookings.flat());

  return json({
    city: city,
    notice: notice?.message,
    tempCapacity: notice?.temp_capacity,
    bookings: grouped,
    additionalBookings: additionalGrouped,
    selfBooking: bookings.find((b) => b.user_id === user.user_id),
    occupancy,
    profiles: profiles.filter((p: Profile | null): p is Profile => p != null),
    user,
    admin,
  });
};

export const links: LinksFunction = () => [
  {
    rel: "stylesheet",
    href: daily,
  },
];

export default function Current() {
  const { date: dateStr } = useParams();
  const {
    bookings,
    selfBooking,
    city,
    occupancy,
    notice,
    tempCapacity,
    profiles,
    admin,
    additionalBookings,
  } = useLoaderData<typeof loader>();
  const { capacity, max_capacity: maxCapacity } = city;
  const deleteFetcher = useFetcher();


  const day = Temporal.PlainDate.from(dateStr!);
  const today = Temporal.Now.plainDateISO();
  const isFuture = Temporal.PlainDate.compare(day, today) >= 0;

  const actualMaxCapacity = tempCapacity ?? maxCapacity;

  const isFull = occupancy >= actualMaxCapacity;

  const [showNameInput, setShowNameInput] = useState(false);
  const [selfPeriod, setSelfPeriod] = useState(selfBooking?.period ?? "day");

  const formatter = new Intl.ListFormat("fr-FR");

  const handleSelfPeriodChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelfPeriod(event.target.value as Period);
  };

  const handleColleagueEmailChange = (
    profileOrEmail: Profile | { email: string } | null,
  ) => {
    if (profileOrEmail == null || "user_id" in profileOrEmail) {
      setShowNameInput(false);
    } else {
      setShowNameInput(true);
    }
  };

  return (
    <>
      <h2>
        {day.toLocaleString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </h2>

      {notice && (
        <h3>
          Note: {notice}.{" "}
          {tempCapacity != null && <>Capacité réduite à {actualMaxCapacity}</>}
        </h3>
      )}

      <p>
        {occupancy}/{Math.min(capacity, actualMaxCapacity)} inscrits.{" "}
        {occupancy > capacity && (
          <>Attention: débordement dans les autres salles à prévoir</>
        )}
      </p>
      <div className="grid">
        <div className="calendar-people">
          <h2>Inscriptions sur {city.label}</h2>
          {(["morning", "day", "afternoon"] as Period[]).map((period) => {
            const periodBookings = bookings[period];
            if (periodBookings.length === 0) return null;

            return (
              <Fragment key={period}>
                <h3>{periods[period]}</h3>
                <ul className="calendar-people__list">
                  {periodBookings
                    .sort(
                      Collator.byKey("created_at", Collator.string)
                    )
                    .map((booking) => {
                      const profile = profiles.find(
                        (p) => p.user_id === booking.user_id,
                      )!;
                      const isDeleteSubmitting =
                        deleteFetcher.state !== "idle" &&
                        deleteFetcher.formData?.get("user_id") == profile.user_id;
                      const isOverflow = isOverflowBooking(booking as any, capacity);
                      const guestsString = formatter.format(
                        Object.entries(booking.guests)
                          .filter((p): p is [string, number] => typeof p[1] === "number" && p[1] > 0)
                          .map((p: [string, number]) => `${p[1]} ${periods[p[0] as Period]}`),
                      );

                      return (
                        <li key={profile.user_id} aria-busy={isDeleteSubmitting}>
                          <Avatar
                            className={cx("avatar", {
                              "avatar--overflow": isOverflow,
                              "avatar--partial": booking.period != "day",
                            })}
                            profile={profile}
                          />
                          <span>{profile.full_name ?? profile.email}</span>
                          {guestsString && ` (+${guestsString})`}
                          {isOverflow && ` (Surnuméraire)`}
                          {admin && isFuture && (
                            <span>
                              {" "}
                              <deleteFetcher.Form
                                method="post"
                                action="/bookings"
                                className="inline-form"
                              >
                                <input type="hidden" name="user_id" value={booking.user_id} />
                                <input type="hidden" name="city" value={booking.city} />
                                <input type="hidden" name="date" value={booking.date} />

                                <button
                                  className="inline-button icon"
                                  name="_action"
                                  value="admin-remove"
                                >
                                  <FiUserMinus
                                    title="Désinscrire"
                                    aria-label="Désinscrire"
                                  />
                                </button>
                              </deleteFetcher.Form>
                            </span>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </Fragment>
            );
          })
          }
        </div>
        <div className="calendar-people">
          <h2>Inscriptions additionnelles</h2>
          {(["morning", "day", "afternoon"] as Period[]).map((period) => {
            const periodBookings = additionalBookings[period];
            if (periodBookings.length === 0) return null;

            return (
              <Fragment key={period}>
                <h3>{periods[period]}</h3>
                <ul className="calendar-people__list">
                  {periodBookings
                    .sort(
                      Collator.byKey("created_at", Collator.string)
                    )
                    .map((booking) => {
                      const profile = profiles.find(
                        (p) => p.user_id === booking.user_id,
                      )!;
                      const isDeleteSubmitting =
                        deleteFetcher.state !== "idle" &&
                        deleteFetcher.formData?.get("user_id") == profile.user_id;
                      const isOverflow = isOverflowBooking(booking as any, capacity);
                      const guestsString = formatter.format(
                        Object.entries(booking.guests)
                          .filter((p): p is [string, number] => typeof p[1] === "number" && p[1] > 0)
                          .map((p: [string, number]) => `${p[1]} ${periods[p[0] as Period]}`),
                      );

                      return (
                        <li key={profile.user_id} aria-busy={isDeleteSubmitting}>
                          <Avatar
                            className={cx("avatar", {
                              "avatar--overflow": isOverflow,
                              "avatar--partial": booking.period != "day",
                            })}
                            profile={profile}
                          />
                          <span>{profile.full_name ?? profile.email}</span>
                          {guestsString && ` (+${guestsString})`}
                          {isOverflow && ` (Surnuméraire)`}
                          {admin && isFuture && (
                            <span>
                              {" "}
                              <deleteFetcher.Form
                                method="post"
                                action="/bookings"
                                className="inline-form"
                              >
                                <input type="hidden" name="user_id" value={booking.user_id} />
                                <input type="hidden" name="city" value={booking.city} />
                                <input type="hidden" name="date" value={booking.date} />

                                <button
                                  className="inline-button icon"
                                  name="_action"
                                  value="admin-remove"
                                >
                                  <FiUserMinus
                                    title="Désinscrire"
                                    aria-label="Désinscrire"
                                  />
                                </button>
                              </deleteFetcher.Form>
                            </span>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </Fragment>
            );
          })
          }
        </div>

      </div>

      {isFuture && (
        <div className="grid">
          <deleteFetcher.Form method="post" action="/bookings">
            <input type="hidden" name="city" value={city.slug} />
            <input type="hidden" name="date" value={day.toString()} />
            <input type="hidden" name="_action" value="book" />
            <fieldset className="guest-form">
              <legend>Je m&apos;inscris sur {city.label}</legend>

              <fieldset role="group">
                <legend>Mon inscription</legend>
                <label>
                  <input
                    type="radio"
                    name="period"
                    value="day"
                    checked={selfPeriod === "day"}
                    onChange={handleSelfPeriodChange}
                  />
                  Journée
                </label>
                <label>
                  <input
                    type="radio"
                    name="period"
                    value="morning"
                    checked={selfPeriod === "morning"}
                    onChange={handleSelfPeriodChange}
                  />
                  Matin
                </label>
                <label>
                  <input
                    type="radio"
                    name="period"
                    value="afternoon"
                    checked={selfPeriod === "afternoon"}
                    onChange={handleSelfPeriodChange}
                  />
                  Après-midi
                </label>
              </fieldset>

              <details>
                <summary>J'ai des invités/invitées avec moi</summary>
                <fieldset role="group">
                  <legend>Invités/invitées</legend>
                  <label>
                    Journée
                    <input
                      type="number"
                      name="guests.day"
                      min="0"
                      max={capacity - occupancy}
                      defaultValue={selfBooking?.guests?.day ?? 0}
                      disabled={selfPeriod !== "day"}
                    />
                  </label>
                  <label>
                    Matin
                    <input
                      type="number"
                      name="guests.morning"
                      min="0"
                      max={capacity - occupancy}
                      defaultValue={selfBooking?.guests?.morning ?? 0}
                      disabled={selfPeriod === "afternoon"}
                    />
                  </label>
                  <label>
                    Après-midi
                    <input
                      type="number"
                      name="guests.afternoon"
                      min="0"
                      max={capacity - occupancy}
                      defaultValue={selfBooking?.guests?.afternoon ?? 0}
                      disabled={selfPeriod === "morning"}
                    />
                  </label>
                </fieldset>
              </details>

              <button
                type="submit"
                disabled={isFull}
                aria-busy={deleteFetcher.state === "submitting"}
              >
                M'inscrire
              </button>
            </fieldset>
          </deleteFetcher.Form>
          <deleteFetcher.Form method="post" action="/bookings">
            <input type="hidden" name="_action" value="book-for" />
            <input type="hidden" name="city" value={city.slug} />
            <input type="hidden" name="date" value={day.toString()} />
            <fieldset className="colleague-form">
              <legend>J&apos;inscris un/une autre Sferian à sa place sur {city.label}</legend>
              <label htmlFor="colleague-email">
                Email
                <ProfileSearch
                  name="for_user"
                  onChange={handleColleagueEmailChange}
                />
              </label>
              {showNameInput && (
                <div>
                  <label htmlFor="colleague-name">Nom</label>
                  <input
                    id="colleague-name"
                    type="text"
                    name="for_user[full_name]"
                  />
                </div>
              )}
              <fieldset role="group">
                <legend>Période</legend>
                <label>
                  <input
                    type="radio"
                    name="period"
                    value="day"
                    defaultChecked
                  />
                  Journée
                </label>
                <label>
                  <input type="radio" name="period" value="morning" />
                  Matin
                </label>
                <label>
                  <input type="radio" name="period" value="afternoon" />
                  Après-midi
                </label>
              </fieldset>

              <button
                type="submit"
                disabled={isFull}
                aria-busy={deleteFetcher.state === "submitting"}
              >
                Inscrire
              </button>
            </fieldset>
          </deleteFetcher.Form>
        </div>
      )}
    </>
  );
}

export const handle = {
  breadcrumb: (match: RouteMatch) => <>{match.params.date}</>,
};
