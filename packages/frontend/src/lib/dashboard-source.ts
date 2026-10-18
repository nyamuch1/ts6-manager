import type { DashboardDataSource } from '@ts6/common';
import i18n from '../i18n';

/** Translate a `dashboard` key at call time; English copy is the pre-init fallback (unit tests). */
function dashboardText(key: string, fallback: string): string {
  if (!i18n.isInitialized) return fallback;
  return i18n.t(`dashboard:${key}`, { defaultValue: fallback });
}

/** Operator-facing dashboard provenance badge label. */
export function dashboardSourceLabel(dataSource: DashboardDataSource | undefined): string {
  const metrics = dataSource?.metrics;
  if (!metrics || metrics.status === 'disabled') {
    return dashboardText('source.webqueryOnly', 'WebQuery only');
  }
  if (metrics.status === 'current') {
    return dashboardText('source.combined', 'WebQuery + native metrics');
  }
  switch (metrics.reason) {
    case 'unreachable':
      return dashboardText('source.unreachable', 'WebQuery · metrics unreachable');
    case 'timeout':
      return dashboardText('source.timeout', 'WebQuery · metrics timed out');
    case 'invalid':
      return dashboardText('source.invalid', 'WebQuery · metrics invalid');
    case 'unscoped':
      return dashboardText('source.unscoped', 'WebQuery · metrics unscoped');
    default:
      return dashboardText('source.unavailable', 'WebQuery · metrics unavailable');
  }
}

/** Longer hint for the provenance badge title attribute. */
export function dashboardSourceHint(dataSource: DashboardDataSource | undefined): string | undefined {
  const metrics = dataSource?.metrics;
  // Missing provenance ≠ scrape disabled — only claim "off" when status is explicit.
  if (!metrics) {
    return dashboardText('source.hintWebquery', 'Dashboard uses authenticated WebQuery.');
  }
  if (metrics.status === 'disabled') {
    return dashboardText(
      'source.hintDisabled',
      'Dashboard uses authenticated WebQuery only. Native metrics scrape is off for this connection.',
    );
  }
  if (metrics.status === 'current') {
    return dashboardText(
      'source.hintCurrent',
      'WebQuery identity plus scoped TeamSpeak native Prometheus metrics.',
    );
  }
  switch (metrics.reason) {
    case 'unreachable':
      return dashboardText(
        'source.hintUnreachable',
        'Metrics scrape could not connect. Ensure TSSERVER_METRICS_ENABLED=1 and TSSERVER_METRICS_IP is reachable from the manager (not localhost-only when the manager is remote), and that metricsHost/port match.',
      );
    case 'timeout':
      return dashboardText(
        'source.hintTimeout',
        'Metrics scrape did not finish before the dashboard returned. A later refresh may pick up a cached scrape if the listener is reachable.',
      );
    case 'invalid':
      return dashboardText(
        'source.hintInvalid',
        'Metrics response was rejected (HTTP status, content-type, or empty/invalid samples).',
      );
    case 'unscoped':
      return dashboardText(
        'source.hintUnscoped',
        'Metrics samples could not be proven to match this virtual server identity; WebQuery values were kept.',
      );
    default:
      return dashboardText(
        'source.hintUnavailable',
        'Native metrics are enabled but unavailable; dashboard kept WebQuery values.',
      );
  }
}
