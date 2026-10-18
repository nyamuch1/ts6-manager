/**
 * Shared encode profile constants for the video defaults UI.
 * Keep values aligned with packages/backend/src/voice/streaming/encode-profiles.ts.
 */

import type { VideoEncodeProfile, VideoStreamPresetKey, VideoStreamSettings } from '@ts6/common';
import i18n from '../i18n';

export type NamedEncodeProfile = Exclude<VideoEncodeProfile, 'custom'>;

// Getters: this module is imported before i18n initialization, so plain
// strings here would be frozen before a locale is selected.
export const ENCODE_PROFILE_PRESETS: Record<
  NamedEncodeProfile,
  { autoMaxPreset: VideoStreamPresetKey; maxBitrateKbps: number; cpuUsed: number; label: string; hint: string }
> = {
  performance: {
    autoMaxPreset: '720p', maxBitrateKbps: 2500, cpuUsed: 6,
    get label() { return i18n.t('media:encodeProfile.performance'); },
    get hint() { return i18n.t('media:encodeProfile.performanceHint'); },
  },
  balanced: {
    autoMaxPreset: '1080p', maxBitrateKbps: 4500, cpuUsed: 4,
    get label() { return i18n.t('media:encodeProfile.balanced'); },
    get hint() { return i18n.t('media:encodeProfile.balancedHint'); },
  },
  quality: {
    autoMaxPreset: '1440p', maxBitrateKbps: 0, cpuUsed: 2,
    get label() { return i18n.t('media:encodeProfile.quality'); },
    get hint() { return i18n.t('media:encodeProfile.qualityHint'); },
  },
};

export function applyEncodeProfile(profile: NamedEncodeProfile): Pick<
  VideoStreamSettings,
  'autoMaxPreset' | 'maxBitrateKbps' | 'cpuUsed' | 'encodeProfile'
> {
  const p = ENCODE_PROFILE_PRESETS[profile];
  return {
    autoMaxPreset: p.autoMaxPreset,
    maxBitrateKbps: p.maxBitrateKbps,
    cpuUsed: p.cpuUsed,
    encodeProfile: profile,
  };
}
