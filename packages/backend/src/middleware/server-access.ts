import { Request, Response, NextFunction } from 'express';
import { translate } from '../i18n/index.js';
import { requestLocale } from '../i18n/middleware.js';

/**
 * H9: Middleware to enforce per-server access control.
 * Admins bypass this check. Viewers must have a UserServerAccess record.
 */
export function requireServerAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Admins have access to all servers
    if (req.user?.role === 'admin') return next();

    const locale = requestLocale(req);
    const configId = parseInt(req.params.configId as string);
    if (isNaN(configId)) {
      res.status(400).json({ error: translate(locale, 'errors.invalid_server_config') });
      return;
    }

    const prisma = req.app.locals.prisma;
    const access = await prisma.userServerAccess.findUnique({
      where: {
        userId_serverConfigId: {
          userId: req.user!.id,
          serverConfigId: configId,
        },
      },
    });

    if (!access) {
      res.status(403).json({ error: translate(locale, 'errors.no_server_access') });
      return;
    }

    next();
  };
}
