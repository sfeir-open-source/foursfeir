import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getUserFromRequest } from "~/services/auth.server";
import { cityService, profileService } from "~/services/application/services.server";
import { IoEye, IoHomeSharp } from "react-icons/io5";
import { splitCities } from "~/services/domain/city.interface";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await getUserFromRequest(request);
  const cities = await cityService.getCities();
  const profile = await profileService.getProfileById(user.user_id);

  return json({
    cities: cities ?? [],
    favoriteCity: profile?.favorite_city ?? null
  });
};

export default function Index() {
  const { cities, favoriteCity } = useLoaderData<typeof loader>();

  const { main: favorite, additional: watched } = splitCities(favoriteCity ?? "");

  return (
    <>
      <main className="container">
        <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.4" }}>
          <hgroup>
            <h1>Welcome to FourSFEIR</h1>
          </hgroup>
          <ul className="city-list">
            {cities.map((city) => {
              return (
                <li key={city.slug}>
                  <Link to={`/${city.slug}`}>{city.label}</Link>

                  {city.slug === favorite ? (
                    <IoHomeSharp
                      title="Favoris"
                      aria-label="Favoris"
                      style={{ color: 'gold' }}
                    />
                  ) : (watched.includes(city.slug) ? (
                    <IoEye
                      title="Lieu additionnel"
                      aria-label="Lieu additionnel"
                      style={{ color: 'lightgrey' }}
                    />
                  ) : (
                    null
                  ))}

                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
