/** Simplified Chinese prose returned in successful diagnostic responses. */
export const diagnosticsZh = {
  // ─── WebQuery connection diagnostics ───────────────────────
  'diagnostics.connection.stage.reachability': '端点可达性',
  'diagnostics.connection.stage.authentication': '身份验证',
  'diagnostics.connection.stage.permissions': '管理读取权限',
  'diagnostics.connection.stage.virtual_server': '虚拟服务器访问',
  'diagnostics.connection.stage_confirmed': '{{stage}}已确认。',
  'diagnostics.connection.flood_retry': 'TeamSpeak 泛洪保护已触发。请在约 {{seconds}} 秒后重试。',
  'diagnostics.connection.flood_wait': 'TeamSpeak 泛洪保护已触发。请稍后重试。',
  'diagnostics.connection.timeout': 'TeamSpeak 端点未及时响应。',
  'diagnostics.connection.unreachable': '无法连接到 TeamSpeak WebQuery 端点。',
  'diagnostics.connection.invalid_apikey': 'WebQuery API 密钥被拒绝。',
  'diagnostics.connection.permission_denied': 'API 密钥缺少所需的管理权限。',
  'diagnostics.connection.query_failed': 'TeamSpeak Query 命令执行失败。',
  'diagnostics.connection.skipped_flood': '因泛洪保护已跳过。',
  'diagnostics.connection.endpoint_reachable_version': '端点可达（{{version}}）。',
  'diagnostics.connection.endpoint_reachable': '端点可达，且已响应版本查询。',
  'diagnostics.connection.endpoint_reachable_auth_rejected':
    '端点可达（TeamSpeak 拒绝了 API 密钥）。',
  'diagnostics.connection.reachability_probe_failed': '无法完成可达性探测。',
  'diagnostics.connection.skipped_reachability': '因可达性检查失败已跳过。',
  'diagnostics.connection.authenticated': '已确认 Query 身份验证。',
  'diagnostics.connection.skipped_auth_probe': '因身份验证探测失败已跳过。',
  'diagnostics.connection.authenticated_identity_unconfirmed':
    '无法确认已通过身份验证的 Query 身份。',
  'diagnostics.connection.skipped_auth': '因身份验证失败已跳过。',
  'diagnostics.connection.permissions_confirmed': '已确认实例级管理读取权限。',
  'diagnostics.connection.skipped_permissions_probe': '因权限探测失败已跳过。',
  'diagnostics.connection.permissions_missing': 'API 密钥缺少所需的管理读取权限。',
  'diagnostics.connection.skipped_permissions': '因权限检查失败已跳过。',
  'diagnostics.connection.virtual_server_accessible': '虚拟服务器 {{sid}} 可访问。',
  'diagnostics.connection.virtual_server_inaccessible':
    '使用此 API 密钥无法访问虚拟服务器 {{sid}}。',
  'diagnostics.connection.toast_success_version':
    'WebQuery 读取阶段正常（{{version}}）— 写操作仍需各自的权限',
  'diagnostics.connection.toast_success': 'WebQuery 读取阶段成功 — 写操作仍需各自的权限',
  'diagnostics.connection.toast_partial': '部分成功：{{message}}',
  'diagnostics.connection.toast_failed': '连接诊断失败',

  // ─── Media admin diagnostics ───────────────────────────────
  'diagnostics.media.image_remediation':
    '请拉取或重新构建 TS6 Manager 镜像。诊断不会向运行中的容器安装二进制文件。',
  'diagnostics.media.not_reported': '未报告',
  'diagnostics.media.skipped_deadline': '已跳过 — 达到整体诊断截止时间',
  'diagnostics.media.encoders_ok':
    'Sidecar 已报告编码器能力（缓存的 GET /encoders；无 GPU 时硬件条目可能不可用）。',
  'diagnostics.media.encoders_unavailable': 'Sidecar 已响应，但没有可用的软件编码器。',
  'diagnostics.media.av1_not_reported': 'Sidecar 未报告 AV1 解码信息（1.11 之前的 Sidecar）。',
  'diagnostics.media.av1_cpu': 'AV1 源使用 CPU 解码（libdav1d）。',
  'diagnostics.media.av1_hw_decode_off': 'VIDEO_HW_DECODE 已关闭，因此未测试 GPU 的 AV1 解码。{{cpu}}',
  'diagnostics.media.av1_no_gpu': '没有可测试的 GPU。{{cpu}}',
  'diagnostics.media.av1_intel_hint':
    ' 在许多 Intel GPU 上，Debian 的免费 VA-API 驱动无法解码 AV1；请参阅视频串流指南中的 INTEL_VAAPI_DRIVER。',
  'diagnostics.media.av1_gpu_failed': 'GPU 无法解码 AV1。{{cpu}}{{intel}}',
  'diagnostics.media.av1_gpu': 'AV1 源使用 GPU 解码（{{accelerators}}）。',
  'diagnostics.media.sidecar_not_checked': '未检查 Sidecar',
  'diagnostics.media.encoders_not_loaded':
    '由于 Sidecar 健康检查未成功，未加载编码器能力。未调用 GET /encoders。',
  'diagnostics.media.encoders_skipped_deadline':
    '已跳过编码器能力检查 — 达到整体诊断截止时间。',
  'diagnostics.media.encoders_timeout':
    '编码器能力未在诊断预算内响应。请使用“串流默认值”中的“检查编码器”。',
  'diagnostics.media.opus_empty_frame': 'Opus 编码器返回了空帧',
  'diagnostics.media.opus_failed': 'Opus 编码器失败',
  'diagnostics.media.opus_ok': '进程内 Opus 编码器已生成静音帧（与音乐播放使用相同设置）。',
  'diagnostics.media.opus_remediation': '音乐播放需要内置的 Opus 编码器。请拉取或重新构建镜像。',
  'diagnostics.media.ffmpeg_remediation': '请确认 ffmpeg 可在后端 PATH 中执行。{{image}}',
  'diagnostics.media.ffprobe_remediation': '请确认 ffprobe 可在后端 PATH 中执行。{{image}}',
  'diagnostics.media.yt_dlp_remediation': '请确认 YT_DLP_PATH 指向可信的可执行文件。{{image}}',
  'diagnostics.media.ffmpeg_smoke_skipped': '因 ffmpeg 不可用已跳过。',
  'diagnostics.media.ffmpeg_smoke_ok':
    '已将短小的合成输入解码为 PCM 并丢弃。没有文件或网络输出。',
  'diagnostics.media.ffmpeg_smoke_remediation':
    '音乐解码路径无法运行有界的 lavfi 冒烟测试。请拉取或重新构建包含 lavfi 解复用器的 ffmpeg 镜像。',
  'diagnostics.media.yt_dlp_extractors_skipped': '因 yt-dlp 不可用已跳过。',
  'diagnostics.media.yt_dlp_extractors_ok':
    'yt-dlp 已在本地列出提取器。未获取任何 URL，也未将 Cookie 读入报告。',
  'diagnostics.media.yt_dlp_extractors_remediation':
    'yt-dlp 无法列出其提取器。请拉取或重新构建镜像；不要在容器内自行更新 yt-dlp。',
  'diagnostics.media.deno_ok': 'Deno 可用于 yt-dlp 的 YouTube 挑战求解（--js-runtimes deno）。',
  'diagnostics.media.deno_remediation': 'Deno 无法运行。YouTube 播放可能无法通过 n 挑战。{{image}}',
  'diagnostics.media.label.ffmpeg': 'FFmpeg',
  'diagnostics.media.label.ffprobe': 'ffprobe',
  'diagnostics.media.label.ffmpeg_smoke': 'FFmpeg 冒烟测试',
  'diagnostics.media.label.opus': 'Opus',
  'diagnostics.media.label.yt_dlp': 'yt-dlp',
  'diagnostics.media.label.yt_dlp_extractors': 'yt-dlp 提取器',
  'diagnostics.media.label.deno': 'Deno',

  // ─── Runtime media diagnostics ─────────────────────────────
  'diagnostics.runtime.binary_missing': '在 PATH 中找不到 {{command}}',
  'diagnostics.runtime.probe_timeout': '{{command}} 未在 {{timeoutMs}}ms 内响应',
  'diagnostics.runtime.probe_exit_code': '{{command}} 退出，代码为 {{exitCode}}',
  'diagnostics.runtime.failed_to_start': '探测启动失败',
  'diagnostics.runtime.probe_failed_to_start': '探测启动失败',
  'diagnostics.runtime.available': '{{label}} 可用',
  'diagnostics.runtime.skipped_deadline': '已跳过 — 达到整体诊断截止时间',
  'diagnostics.runtime.yt_dlp_missing':
    '找不到 yt-dlp — 请拉取或重新构建 TS6 Manager 镜像以恢复内置提取器',
  'diagnostics.runtime.ffmpeg_missing': '找不到 ffmpeg — 音频/视频解码需要后端 PATH 中有 ffmpeg',
  'diagnostics.runtime.ffprobe_missing': '找不到 ffprobe — 媒体时长/元数据探测需要 ffprobe',
  'diagnostics.runtime.yt_dlp_path_invalid':
    'YT_DLP_PATH 必须是指向可信 yt-dlp 可执行文件的绝对路径',
  'diagnostics.runtime.egress_disabled':
    '媒体下载保护已关闭（MEDIA_EGRESS_PROXY=off）：连接时不会检查下载，且仅接受 YouTube 链接',
  'diagnostics.runtime.egress_unavailable': '媒体下载不可用：{{problem}}',
  'diagnostics.runtime.sidecar_reachable': 'Sidecar 健康端点可达',
  'diagnostics.runtime.sidecar_local_listening': '本地 Sidecar 正在监听',
  'diagnostics.runtime.reachable_mismatch': '{{reachable}}，但 {{note}}',
  'diagnostics.runtime.sidecar_url_timeout': '配置 URL 上的 Sidecar 未在 {{budget}}ms 内响应',
  'diagnostics.runtime.sidecar_health_failed':
    'Sidecar 健康检查失败 — 请验证 SIDECAR_URL 以及 Sidecar 容器是否正在运行',
  'diagnostics.runtime.sidecar_binary_missing':
    '找不到 Sidecar 二进制文件 — 请在 Docker 中设置 SIDECAR_BINARY_PATH 或使用 SIDECAR_URL',
  'diagnostics.runtime.sidecar_binary_deadline':
    'Sidecar 二进制文件存在 — 未检查监听状态（已达截止时间）',
  'diagnostics.runtime.sidecar_not_listening':
    'Sidecar 二进制文件存在 — 尚未监听（视频串流开始时启动）',

  // ─── Media lifecycle wording (bot chat + lastStop) ─────────
  'diagnostics.lifecycle.duration': '{{count}}{{unit}}',
  'diagnostics.lifecycle.unit.second_one': '秒',
  'diagnostics.lifecycle.unit.second_other': '秒',
  'diagnostics.lifecycle.unit.minute_one': '分钟',
  'diagnostics.lifecycle.unit.minute_other': '分钟',
  'diagnostics.lifecycle.unit.hour_one': '小时',
  'diagnostics.lifecycle.unit.hour_other': '小时',
  'diagnostics.lifecycle.auto_stop_music': '已停止音乐：频道已空置{{duration}}。',
  'diagnostics.lifecycle.auto_stop_radio': '已停止电台：频道已空置{{duration}}。',
  'diagnostics.lifecycle.auto_stop_stream_no_viewers': '已停止串流：无人观看已持续{{duration}}。',
  'diagnostics.lifecycle.auto_stop_stream_channel_empty': '已停止串流：频道已空置{{duration}}。',
  'diagnostics.lifecycle.no_viewer_warning': '目前无人观看。串流将在 1 分钟后停止。',
  'diagnostics.lifecycle.stop_no_viewers': '在无人观看{{duration}}后停止',
  'diagnostics.lifecycle.stop_channel_empty': '在频道空置{{duration}}后停止',
  'diagnostics.lifecycle.source_unreachable': '媒体源已无法访问',
  'diagnostics.lifecycle.drm': '此频道使用 DRM 加密，无法在此播放',
  'diagnostics.lifecycle.key_unavailable': '无法获取串流解密密钥 — 密钥 URL 可能已过期或被拦截',
  'diagnostics.lifecycle.no_streams': '播放列表没有可播放的串流（变体失败或为空）',
  'diagnostics.lifecycle.http_400': '媒体源返回 400 Bad Request — URL 可能无效或已过期',
  'diagnostics.lifecycle.http_401': '媒体源返回 401 Unauthorized — 可能需要凭据或令牌',
  'diagnostics.lifecycle.http_403': '媒体源返回 403 Forbidden — 访问可能被阻止',
  'diagnostics.lifecycle.http_404': '媒体源返回 404 Not Found — 串流 URL 可能已失效或已移动',
  'diagnostics.lifecycle.http_other': '媒体源返回 HTTP {{code}}',
  'diagnostics.lifecycle.network': '无法连接到媒体源（网络或 DNS 故障）',
  'diagnostics.lifecycle.video_ended': '视频已播放完毕',
  'diagnostics.lifecycle.live_ended': '直播源已结束',
  'diagnostics.lifecycle.encoder_stopped_with_error': '编码器已停止：{{error}}',
  'diagnostics.lifecycle.encoder_stopped': '编码器意外停止',
  'diagnostics.lifecycle.unknown_speed': '未知速度',
  'diagnostics.lifecycle.rtp_drops': '，{{count}} 个丢包',
  'diagnostics.lifecycle.from_source': '，来源为 {{mode}} 源',
  'diagnostics.lifecycle.below_realtime':
    '编码速度低于实时（{{speed}}，持续 {{seconds}} 秒{{drops}}），{{preset}}，使用 {{encoder}}{{mode}}。主机性能不足 — 请尝试更低的预设或硬件编码器。',
} as const;
