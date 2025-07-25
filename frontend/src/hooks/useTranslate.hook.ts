import { getCookie } from "cookies-next";
import { createIntl, createIntlCache, useIntl } from "react-intl";
import i18nUtil from "../utils/i18n.util";

const useTranslate = () => {
  const intl = useIntl();
  return (
    id: string,
    values?: Parameters<typeof intl.formatMessage>[1],
    opts?: Parameters<typeof intl.formatMessage>[2],
  ) => {
    return intl.formatMessage({ id }, values, opts) as string;
  };
};

const cache = createIntlCache();

export const translateOutsideContext = () => {
  const locale =
    getCookie("language")?.toString() ?? navigator.language.split("-")[0];

  // fall back to english if key does not exist
  const englishMessages = i18nUtil.getLocaleByCode("en-US")?.messages;
  const intl = createIntl(
    {
      locale,
      messages: {...englishMessages, ...i18nUtil.getLocaleByCode(locale)?.messages},
      defaultLocale: "en",
    },
    cache,
  );
  return (
    id: string,
    values?: Parameters<typeof intl.formatMessage>[1],
    opts?: Parameters<typeof intl.formatMessage>[2],
  ) => {
    return intl.formatMessage({ id }, values, opts) as string;
  };
};

export default useTranslate;
