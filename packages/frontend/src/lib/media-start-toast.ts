import { toast } from 'sonner';
import i18n from '../i18n';

/**
 * Success toast after media starts playing. Stays on the current page and
 * offers a one-click jump to Bot Hub for live status / stop.
 */
export function toastMediaStarted(message: string): void {
  toast.success(message, {
    action: {
      label: i18n.t('media:toast.openBotHub'),
      onClick: () => {
        window.location.assign('/bot-hub');
      },
    },
  });
}
