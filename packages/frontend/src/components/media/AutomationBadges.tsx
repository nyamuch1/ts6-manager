import type { BotMediaOverview } from '@ts6/common';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

/** Auto-DJ and 24/7 badges for a bot; renders nothing when both are off. */
export function AutomationBadges({ bot }: { bot: BotMediaOverview }) {
  const { t } = useTranslation('media');
  const automation = bot.automation;
  if (!automation) return null;

  const badges: { label: string; title: string }[] = [];
  if (automation.autoDj) {
    const radio = automation.sourceKind === 'radio';
    badges.push(automation.playing
      ? {
        label: t('automation.autoDjPlayingLabel'),
        title: t(radio
          ? 'automation.autoDjPlayingRadioTitle'
          : 'automation.autoDjPlayingPlaylistTitle'),
      }
      : {
        label: t('automation.autoDjLabel'),
        title: t(radio
          ? 'automation.autoDjOnRadioTitle'
          : 'automation.autoDjOnPlaylistTitle'),
      });
  }
  if (automation.stayInChannel) {
    badges.push({
      label: t('automation.stayInChannelLabel'),
      title: t('automation.stayInChannelTitle'),
    });
  }

  return (
    <>
      {badges.map((badge) => (
        <Badge key={badge.label} variant="outline" className="shrink-0" title={badge.title} aria-label={badge.title}>
          {badge.label}
        </Badge>
      ))}
    </>
  );
}
