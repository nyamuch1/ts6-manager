import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@ts6/common';
import { translate } from '../i18n/index.js';
import { requestLocale } from '../i18n/middleware.js';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const locale = requestLocale(req);
    if (!req.user) {
      res.status(401).json({ error: translate(locale, 'errors.not_authenticated') });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: translate(locale, 'errors.insufficient_permissions') });
      return;
    }
    next();
  };
}
