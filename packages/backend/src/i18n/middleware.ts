import type { Request, RequestHandler } from 'express';
import { DEFAULT_LOCALE, negotiateLocale, type SupportedLocale } from './index.js';

declare global {
  namespace Express {
    interface Request {
      /** Locale negotiated from Accept-Language; set by localeMiddleware. */
      locale?: SupportedLocale;
    }
  }
}

export function requestLocale(req: Request): SupportedLocale {
  return req.locale ?? DEFAULT_LOCALE;
}

/**
 * Resolves the response language once per request and marks cacheable output
 * as language-dependent so shared caches do not mix locales.
 */
export const localeMiddleware: RequestHandler = (req, res, next) => {
  const locale = negotiateLocale(req.headers['accept-language']);
  req.locale = locale;
  res.setHeader('Content-Language', locale);
  res.vary('Accept-Language');
  next();
};
