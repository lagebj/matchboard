import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE_NAME, isSupportedLocale, matchAcceptLanguage } from "./locale";

/**
 * No `[locale]` route segment is used (see locale.ts) -- `requestLocale` from next-intl
 * is therefore always undefined here and deliberately unused. Locale is resolved from
 * the NEXT_LOCALE cookie, falling back to the Accept-Language header, falling back to
 * English -- the precedence PROGRAMME.md §9 requires.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  const locale = isSupportedLocale(cookieLocale)
    ? cookieLocale
    : matchAcceptLanguage((await headers()).get("accept-language"));

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
