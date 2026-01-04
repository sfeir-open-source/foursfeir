import { Link, useFetcher } from "@remix-run/react";
import { Temporal } from "temporal-polyfill";
import cx from "classnames";

import Avatar from "./Avatar";
import { BookingsInlineSummary } from "./BookingsInlineSummary";
import { Fragment } from "react";
import {
  IndexedBooking,
  periods,
  groupBookings,
  Period,
  isOverflowBooking,
  Booking,
} from "~/services/domain/booking.interface";
import { Profile } from "~/services/domain/profile.interface";
import { emailToFoursfeirId } from "~/services/domain/profile.interface";

type Props = {
  date: Temporal.PlainDate;
  bookings: (IndexedBooking & { profile: Profile })[];
  additionalBookings: (Booking & { profile: Profile })[];
  occupancy: number;
  userId: string;
  combinedSlug: string;
  city: string;
  notice?: string;
  capacity: number;
  maxCapacity: number;
  className?: string;
};

export function CalendarDay({
  date,
  occupancy,
  bookings,
  additionalBookings,
  userId,
  combinedSlug,
  city,
  notice,
  capacity,
  maxCapacity,
  className,
}: Props) {
  const fetcher = useFetcher();

  const self = bookings.find(
    (p) => emailToFoursfeirId(p.profile?.email) === userId,
  );
  const hasBooking = self != null;

  const byPeriod = groupBookings(bookings);

  const today = Temporal.Now.plainDateISO();
  const isToday = Temporal.PlainDate.compare(date, today) === 0;
  const isFuture = Temporal.PlainDate.compare(date, today) >= 0;

  const isSubmitting = fetcher.state !== "idle";

  const selfFormId = `${date.toString()}-self`;

  const isVisuallyFull = occupancy >= capacity;
  const isFull = occupancy >= maxCapacity;

  const formatter = new Intl.ListFormat("fr-FR");

  return (
    <article
      className={cx(
        "calendar-day",
        {
          "calendar-day--full": isVisuallyFull,
          "calendar-day--today": isToday,
        },
        className,
      )}
      aria-busy={isSubmitting}
    >
      <h2 className="day__name">
        {date.toLocaleString("fr-FR", {
          weekday: "short",
          day: "numeric",
        })}
        {notice && <> &mdash; {notice}</>}
      </h2>
      {"   "}
      <>
        <div>
          {isFuture && (
            <fetcher.Form method="post" action="/bookings" id={selfFormId}>
              {self && (
                <input
                  type="hidden"
                  name="user_id"
                  value={self.user_id}
                />
              )}
              <input type="hidden" name="city" value={city} />
              <input type="hidden" name="date" value={date.toString()} />
              <input
                type="hidden"
                name="_action"
                value={hasBooking ? "remove" : "book"}
              />
            </fetcher.Form>
          )}
          <details className="calendar-people">
            <BookingsInlineSummary
              bookings={bookings}
              additionalBookings={additionalBookings}
              capacity={capacity}
              hasBooking={hasBooking}
              isFuture={isFuture}
              isFull={isFull}
              selfFormId={selfFormId}
            />
            {Object.entries(periods).map(([period, label]) => {
              const bookings = byPeriod[period as Period];

              if (bookings.length > 0) {
                return (
                  <Fragment key={period}>
                    <h3>{label}</h3>
                    <ul
                      className="calendar-people__list calendar-people--expanded"
                      key={period}
                    >
                      {bookings.map((booking) => {
                        const isOverflow = isOverflowBooking(booking, capacity);
                        const guestsString = formatter.format(
                          Object.entries(booking.guests)
                            .filter((p) => p[1] > 0)
                            .map((p) => `${p[1]} ${periods[p[0] as Period]}`),
                        );
                        const { profile } = booking;
                        return (
                          <li key={profile?.user_id}>
                            <Avatar
                              className={cx({
                                "avatar--partial": period !== "day",
                                "avatar--morning": period === "morning",
                                "avatar--afternoon": period === "afternoon",
                                "avatar--overflow": isOverflow,
                              })}
                              profile={booking.profile}
                            />
                            <span>{profile?.full_name ?? profile?.email}</span>
                            {guestsString && ` (+${guestsString})`}
                            {isOverflow && ` (Surnuméraire)`}
                          </li>
                        );
                      })}
                    </ul>
                  </Fragment>
                );
              }
            })}
            {additionalBookings.length > 0 && (
              <Fragment>
                <h3>Également inscrit•es</h3>
                <ul className="calendar-people__list calendar-people--expanded">
                  {additionalBookings.map((booking) => {
                    const guestsString = formatter.format(
                      Object.entries(booking.guests)
                        .filter((p) => p[1] > 0)
                        .map((p) => `${p[1]} ${periods[p[0] as Period]}`),
                    );
                    const { profile } = booking;
                    return (
                      <li key={profile?.user_id}>
                        <Avatar
                          className={cx("avatar--additional", {
                            "avatar--partial": booking.period !== "day",
                          })}
                          profile={booking.profile}
                        />
                        <span>{profile?.full_name ?? profile?.email}</span>
                        {guestsString && ` (+${guestsString})`} - {periods[booking.period]}
                      </li>
                    );
                  })}
                </ul>
              </Fragment>
            )}

            <div className="calendar-day__actions">
              {isFuture && (
                <div>
                  {hasBooking ? (
                    <button
                      type="submit"
                      form={selfFormId}
                      className="calendar-people__book-self"
                    >
                      Se désinscrire
                    </button>
                  ) : isFull ? (
                    <button disabled className="calendar-people__book-self">
                      Capacité atteinte
                    </button>
                  ) : (
                    <details className="dropdown">
                      <summary role="button">S&apos;inscrire</summary>
                      <ul>
                        <li>
                          <button
                            type="submit"
                            form={selfFormId}
                            name="period"
                            value="day"
                            className="inline-button no-button calendar-people__book-self"
                            disabled={isFull}
                          >
                            Journée
                          </button>
                        </li>
                        <li>
                          <button
                            type="submit"
                            form={selfFormId}
                            name="period"
                            value="morning"
                            className="inline-button no-button calendar-people__book-self"
                            disabled={isFull}
                          >
                            Matin
                          </button>
                        </li>
                        <li>
                          <button
                            type="submit"
                            form={selfFormId}
                            name="period"
                            value="afternoon"
                            className="inline-button no-button calendar-people__book-self"
                            disabled={isFull}
                          >
                            Après-midi
                          </button>
                        </li>
                      </ul>
                    </details>
                  )}
                </div>
              )}
              <Link to={`/${combinedSlug}/${date.toString()}`}>Détails</Link>
            </div>
          </details>
        </div>
      </>
      <progress
        value={occupancy}
        max={capacity}
        className="calendar-day__gauge"
      />
    </article>
  );
}
