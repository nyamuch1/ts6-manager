/** English prose returned in successful diagnostic responses. */
export const diagnosticsEn = {
  // ─── WebQuery connection diagnostics ───────────────────────
  'diagnostics.connection.stage.reachability': 'Endpoint reachability',
  'diagnostics.connection.stage.authentication': 'Authentication',
  'diagnostics.connection.stage.permissions': 'Management read permissions',
  'diagnostics.connection.stage.virtual_server': 'Virtual server access',
  'diagnostics.connection.stage_confirmed': '{{stage}} confirmed.',
  'diagnostics.connection.flood_retry': 'TeamSpeak flood protection is active. Retry in about {{seconds}}s.',
  'diagnostics.connection.flood_wait': 'TeamSpeak flood protection is active. Wait before retrying.',
  'diagnostics.connection.timeout': 'The TeamSpeak endpoint did not respond in time.',
  'diagnostics.connection.unreachable': 'Could not reach the TeamSpeak WebQuery endpoint.',
  'diagnostics.connection.invalid_apikey': 'The WebQuery API key was rejected.',
  'diagnostics.connection.permission_denied': 'The API key lacks the required management permissions.',
  'diagnostics.connection.query_failed': 'The TeamSpeak Query command failed.',
  'diagnostics.connection.skipped_flood': 'Skipped after flood protection.',
  'diagnostics.connection.endpoint_reachable_version': 'Endpoint reachable ({{version}}).',
  'diagnostics.connection.endpoint_reachable': 'Endpoint reachable and responded to version.',
  'diagnostics.connection.endpoint_reachable_auth_rejected': 'Endpoint reachable (TeamSpeak rejected the API key).',
  'diagnostics.connection.reachability_probe_failed': 'Could not complete the reachability probe.',
  'diagnostics.connection.skipped_reachability': 'Skipped after reachability failed.',
  'diagnostics.connection.authenticated': 'Authenticated Query identity confirmed.',
  'diagnostics.connection.skipped_auth_probe': 'Skipped after authentication probe failed.',
  'diagnostics.connection.authenticated_identity_unconfirmed': 'Could not confirm an authenticated Query identity.',
  'diagnostics.connection.skipped_auth': 'Skipped after authentication failed.',
  'diagnostics.connection.permissions_confirmed': 'Instance-level management read permissions confirmed.',
  'diagnostics.connection.skipped_permissions_probe': 'Skipped after permissions probe failed.',
  'diagnostics.connection.permissions_missing': 'The API key lacks required management read permissions.',
  'diagnostics.connection.skipped_permissions': 'Skipped after permissions failed.',
  'diagnostics.connection.virtual_server_accessible': 'Virtual server {{sid}} is accessible.',
  'diagnostics.connection.virtual_server_inaccessible': 'Virtual server {{sid}} is not accessible with this API key.',
  'diagnostics.connection.toast_success_version':
    'WebQuery read stages OK ({{version}}) — write actions still need their own permissions',
  'diagnostics.connection.toast_success':
    'WebQuery read stages succeeded — write actions still need their own permissions',
  'diagnostics.connection.toast_partial': 'Partial: {{message}}',
  'diagnostics.connection.toast_failed': 'Connection diagnostics failed',

  // ─── Media admin diagnostics ───────────────────────────────
  'diagnostics.media.image_remediation':
    'Pull or rebuild the TS6 Manager image. Diagnostics do not install binaries into a running container.',
  'diagnostics.media.not_reported': 'Not reported',
  'diagnostics.media.skipped_deadline': 'Skipped — overall diagnostic deadline reached',
  'diagnostics.media.encoders_ok':
    'Sidecar reported encoder capabilities (cached GET /encoders; hardware rows can be unavailable without a GPU).',
  'diagnostics.media.encoders_unavailable': 'Sidecar answered, but no software encoder is available.',
  'diagnostics.media.av1_not_reported': 'The sidecar does not report AV1 decoding (sidecars before 1.11).',
  'diagnostics.media.av1_cpu': 'AV1 sources decode on the CPU (libdav1d).',
  'diagnostics.media.av1_hw_decode_off': 'VIDEO_HW_DECODE is off, so the GPU is not tested for AV1. {{cpu}}',
  'diagnostics.media.av1_no_gpu': 'No GPU to test. {{cpu}}',
  'diagnostics.media.av1_intel_hint':
    ' On many Intel GPUs the free Debian VA-API driver cannot decode AV1; see INTEL_VAAPI_DRIVER in the video streaming guide.',
  'diagnostics.media.av1_gpu_failed': 'The GPU does not decode AV1. {{cpu}}{{intel}}',
  'diagnostics.media.av1_gpu': 'AV1 sources decode on the GPU ({{accelerators}}).',
  'diagnostics.media.sidecar_not_checked': 'Sidecar was not checked',
  'diagnostics.media.encoders_not_loaded':
    'Encoder capabilities were not loaded because the sidecar health check did not succeed. GET /encoders was not called.',
  'diagnostics.media.encoders_skipped_deadline':
    'Skipped encoder capabilities — overall diagnostic deadline reached.',
  'diagnostics.media.encoders_timeout':
    'Encoder capabilities did not answer within the diagnostic budget. Use Check encoders on Streaming defaults.',
  'diagnostics.media.opus_empty_frame': 'Opus encoder returned an empty frame',
  'diagnostics.media.opus_failed': 'Opus encoder failed',
  'diagnostics.media.opus_ok':
    'In-process Opus encoder produced a silent frame (same settings as music playback).',
  'diagnostics.media.opus_remediation': 'Music playback needs the bundled Opus encoder. Pull or rebuild the image.',
  'diagnostics.media.ffmpeg_remediation': 'Verify ffmpeg is executable on the backend PATH. {{image}}',
  'diagnostics.media.ffprobe_remediation': 'Verify ffprobe is executable on the backend PATH. {{image}}',
  'diagnostics.media.yt_dlp_remediation': 'Verify YT_DLP_PATH points to a trusted executable. {{image}}',
  'diagnostics.media.ffmpeg_smoke_skipped': 'Skipped because ffmpeg is not available.',
  'diagnostics.media.ffmpeg_smoke_ok':
    'Decoded a short synthetic input to PCM and discarded it. No file or network output.',
  'diagnostics.media.ffmpeg_smoke_remediation':
    'The music decode path could not run a bounded lavfi smoke. Pull or rebuild an image whose ffmpeg includes the lavfi demuxer.',
  'diagnostics.media.yt_dlp_extractors_skipped': 'Skipped because yt-dlp is not available.',
  'diagnostics.media.yt_dlp_extractors_ok':
    'yt-dlp listed extractors locally. No URL was fetched and no cookies were read into the report.',
  'diagnostics.media.yt_dlp_extractors_remediation':
    'yt-dlp could not list its extractors. Pull or rebuild the image; do not self-update yt-dlp inside a container.',
  'diagnostics.media.deno_ok': 'Deno is available for yt-dlp YouTube challenge solving (--js-runtimes deno).',
  'diagnostics.media.deno_remediation':
    'Deno could not run. YouTube playback can fail the n challenge. {{image}}',
  'diagnostics.media.label.ffmpeg': 'FFmpeg',
  'diagnostics.media.label.ffprobe': 'ffprobe',
  'diagnostics.media.label.ffmpeg_smoke': 'FFmpeg smoke',
  'diagnostics.media.label.opus': 'Opus',
  'diagnostics.media.label.yt_dlp': 'yt-dlp',
  'diagnostics.media.label.yt_dlp_extractors': 'yt-dlp extractors',
  'diagnostics.media.label.deno': 'Deno',

  // ─── Runtime media diagnostics ─────────────────────────────
  'diagnostics.runtime.binary_missing': '{{command}} was not found on PATH',
  'diagnostics.runtime.probe_timeout': '{{command}} did not respond within {{timeoutMs}}ms',
  'diagnostics.runtime.probe_exit_code': '{{command}} exited with code {{exitCode}}',
  'diagnostics.runtime.failed_to_start': 'Failed to start probe',
  'diagnostics.runtime.probe_failed_to_start': 'Probe failed to start',
  'diagnostics.runtime.available': '{{label}} available',
  'diagnostics.runtime.skipped_deadline': 'Skipped — overall diagnostic deadline reached',
  'diagnostics.runtime.yt_dlp_missing':
    'yt-dlp was not found — pull or rebuild the TS6 Manager image to restore the bundled extractor',
  'diagnostics.runtime.ffmpeg_missing':
    'ffmpeg was not found — audio/video decode requires ffmpeg on the backend PATH',
  'diagnostics.runtime.ffprobe_missing':
    'ffprobe was not found — media duration/metadata probes require ffprobe',
  'diagnostics.runtime.yt_dlp_path_invalid':
    'YT_DLP_PATH must be an absolute path to a trusted yt-dlp executable',
  'diagnostics.runtime.egress_disabled':
    'Media download protection is switched off (MEDIA_EGRESS_PROXY=off): downloads are not checked at connection time and only YouTube links are accepted',
  'diagnostics.runtime.egress_unavailable': 'Media downloads are unavailable: {{problem}}',
  'diagnostics.runtime.sidecar_reachable': 'Sidecar health endpoint reachable',
  'diagnostics.runtime.sidecar_local_listening': 'Local sidecar is listening',
  'diagnostics.runtime.reachable_mismatch': '{{reachable}}, but {{note}}',
  'diagnostics.runtime.sidecar_url_timeout':
    'Sidecar at configured URL did not respond within {{budget}}ms',
  'diagnostics.runtime.sidecar_health_failed':
    'Sidecar health check failed — verify SIDECAR_URL and that the sidecar container is running',
  'diagnostics.runtime.sidecar_binary_missing':
    'Sidecar binary was not found — set SIDECAR_BINARY_PATH or use SIDECAR_URL in Docker',
  'diagnostics.runtime.sidecar_binary_deadline':
    'Sidecar binary present — listening state not checked (deadline reached)',
  'diagnostics.runtime.sidecar_not_listening':
    'Sidecar binary present — not listening yet (starts when video streaming begins)',

  // ─── Media lifecycle wording (bot chat + lastStop) ─────────
  'diagnostics.lifecycle.duration': '{{count}} {{unit}}',
  'diagnostics.lifecycle.unit.second_one': 'second',
  'diagnostics.lifecycle.unit.second_other': 'seconds',
  'diagnostics.lifecycle.unit.minute_one': 'minute',
  'diagnostics.lifecycle.unit.minute_other': 'minutes',
  'diagnostics.lifecycle.unit.hour_one': 'hour',
  'diagnostics.lifecycle.unit.hour_other': 'hours',
  'diagnostics.lifecycle.auto_stop_music':
    'Stopped the music: the channel was empty for {{duration}}.',
  'diagnostics.lifecycle.auto_stop_radio':
    'Stopped radio: the channel was empty for {{duration}}.',
  'diagnostics.lifecycle.auto_stop_stream_no_viewers':
    'Stopped the stream: nobody watched for {{duration}}.',
  'diagnostics.lifecycle.auto_stop_stream_channel_empty':
    'Stopped the stream: the channel was empty for {{duration}}.',
  'diagnostics.lifecycle.no_viewer_warning': 'Nobody is watching. The stream stops in 1 minute.',
  'diagnostics.lifecycle.stop_no_viewers': 'Stopped after {{duration}} with no viewers',
  'diagnostics.lifecycle.stop_channel_empty': 'Stopped after the channel was empty for {{duration}}',
  'diagnostics.lifecycle.source_unreachable': 'Source became unreachable',
  'diagnostics.lifecycle.drm': 'This channel uses DRM encryption and cannot be played here',
  'diagnostics.lifecycle.key_unavailable':
    'Could not fetch the stream decryption key — the key URL may be expired or blocked',
  'diagnostics.lifecycle.no_streams': 'Playlist has no playable streams (variants failed or empty)',
  'diagnostics.lifecycle.http_400': 'Source returned 400 Bad Request — URL may be invalid or expired',
  'diagnostics.lifecycle.http_401':
    'Source returned 401 Unauthorized — credentials or a token may be required',
  'diagnostics.lifecycle.http_403': 'Source returned 403 Forbidden — access may be blocked',
  'diagnostics.lifecycle.http_404': 'Source returned 404 Not Found — stream URL may be dead or moved',
  'diagnostics.lifecycle.http_other': 'Source returned HTTP {{code}}',
  'diagnostics.lifecycle.network': 'Could not reach the media source (network or DNS failure)',
  'diagnostics.lifecycle.video_ended': 'Video reached its end',
  'diagnostics.lifecycle.live_ended': 'Live source ended',
  'diagnostics.lifecycle.encoder_stopped_with_error': 'Encoder stopped: {{error}}',
  'diagnostics.lifecycle.encoder_stopped': 'Encoder stopped unexpectedly',
  'diagnostics.lifecycle.unknown_speed': 'unknown speed',
  'diagnostics.lifecycle.rtp_drops': ', {{count}} packets dropped',
  'diagnostics.lifecycle.from_source': ' from a {{mode}} source',
  'diagnostics.lifecycle.below_realtime':
    'Encoding below realtime ({{speed}} for {{seconds}} s{{drops}}) at {{preset}} with {{encoder}}{{mode}}. The host cannot keep up — try a lower preset or a hardware encoder.',
} as const;
