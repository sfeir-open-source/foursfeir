import cx from "classnames";
import { BsPlusCircleDotted } from "react-icons/bs";

import Avatar from "./Avatar";
import {
  IndexedBooking,
  periods,
  isOverflowBooking,
  Booking,
} from "~/services/domain/booking.interface";
import { Profile } from "~/services/domain/profile.interface";

type BookingsInlineSummaryProps = {
  bookings: (IndexedBooking & { profile: Profile })[];
  additionalBookings: (Booking & { profile: Profile })[];
  capacity: number;
  hasBooking: boolean;
  isFuture: boolean;
  isFull: boolean;
  selfFormId: string;
};

export function BookingsInlineSummary({
  bookings,
  additionalBookings,
  capacity,
  hasBooking,
  isFuture,
  isFull,
  selfFormId,
}: BookingsInlineSummaryProps) {
  return (
    <summary className="calendar-people__header">
      <div>
        {(bookings.length > 0 || isFuture) && (
          <ul className="calendar-people__list calendar-people__list--inline">
            {bookings.map((booking) => {
              const isOverflow = isOverflowBooking(booking, capacity);
              const overflowStr = isOverflow ? " (Surnuméraire)" : "";
              return (
                <li
                  key={booking.user_id}
                  data-tooltip={`${booking.profile?.full_name ?? booking.profile?.email
                    } - ${periods[booking.period]}${overflowStr}`}
                >
                  <Avatar
                    className={cx({
                      "avatar--partial": booking.period !== "day",
                      "avatar--morning": booking.period === "morning",
                      "avatar--afternoon": booking.period === "afternoon",
                      "avatar--overflow": isOverflow,
                    })}
                    profile={booking.profile}
                  />
                </li>
              );
            })}
            {!hasBooking && isFuture && !isFull && (
              <li>
                <button
                  type="submit"
                  form={selfFormId}
                  name="period"
                  value="day"
                  className="inline-button no-button calendar-people__book-self"
                >
                  <BsPlusCircleDotted className="avatar icon" />
                </button>
              </li>
            )}
          </ul>
        )}

        {additionalBookings.length > 0 && (
          <ul className="calendar-people__list calendar-people__list--inline">
            {additionalBookings.map((booking) => {
              return (
                <li key={booking.user_id}
                  data-tooltip={`${booking.profile?.full_name ?? booking.profile?.email
                    } - ${periods[booking.period]}`}
                >
                  <Avatar className={cx("avatar--additional", {
                    "avatar--partial": booking.period !== "day",
                    "avatar--morning": booking.period === "morning",
                    "avatar--afternoon": booking.period === "afternoon",
                  })} profile={booking.profile} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </summary>
  );
}

