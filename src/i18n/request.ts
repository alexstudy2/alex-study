import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const saved = (await cookies()).get("alex-study-locale")?.value;
  const locale = requested === "ar" || saved === "ar" ? "ar" : "en";
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
