const DEFAULT_ENDPOINT = window.GH_DASHBOARD_CONFIG?.apiEndpoint ?? '';
const TOKEN_KEY = 'gh_dashboard_token';

const elements = {
  form: document.querySelector('#dashboard-form'),
  endpoint: document.querySelector('#api-endpoint'),
  token: document.querySelector('#dashboard-token'),
  from: document.querySelector('#date-from'),
  to: document.querySelector('#date-to'),
  channel: document.querySelector('#channel'),
  host: document.querySelector('#host-filter'),
  contentVersion: document.querySelector('#content-version'),
  status: document.querySelector('#status-line'),
  rollupMeta: document.querySelector('#rollup-meta'),
  funnel: document.querySelector('#funnel-list'),
  shareBody: document.querySelector('#share-body'),
  questionBody: document.querySelector('#question-body'),
  resultBody: document.querySelector('#result-body'),
};

const metrics = {
  pv: document.querySelector('#metric-pv'),
  uv: document.querySelector('#metric-uv'),
  sessions: document.querySelector('#metric-sessions'),
  start: document.querySelector('#metric-start'),
  complete: document.querySelector('#metric-complete'),
  completionRate: document.querySelector('#metric-completion-rate'),
  resultView: document.querySelector('#metric-result-view'),
  share: document.querySelector('#metric-share'),
};

initialize();

function initialize() {
  const today = getShanghaiDate();
  elements.endpoint.value = DEFAULT_ENDPOINT;
  elements.token.value = sessionStorage.getItem(TOKEN_KEY) || '';
  elements.from.value = today;
  elements.to.value = today;

  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    void loadDashboard();
  });
}

async function loadDashboard() {
  const endpoint = elements.endpoint.value.trim();
  const token = elements.token.value.trim();
  const from = elements.from.value;
  const to = elements.to.value;
  const channel = elements.channel.value.trim() || 'all';
  const host = elements.host.value.trim();
  const contentVersion = elements.contentVersion.value.trim();

  if (!endpoint || !token) {
    setStatus('请填写 API 地址和 token。', true);
    return;
  }

  sessionStorage.setItem(TOKEN_KEY, token);
  setStatus('正在读取聚合报表...');

  try {
    const url = new URL(endpoint);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    url.searchParams.set('channel', channel);
    if (host) url.searchParams.set('host', host);
    if (contentVersion) url.searchParams.set('contentVersion', contentVersion);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    renderDashboard(data);
    setStatus(formatLoadedStatus(data));
  } catch (error) {
    setStatus(`读取失败：${error.message}`, true);
  }
}

function renderDashboard(data) {
  const summary = data.summary || {};
  metrics.pv.textContent = formatNumber(summary.pv);
  metrics.uv.textContent = formatNumber(summary.uv);
  metrics.sessions.textContent = formatNumber(summary.sessions);
  metrics.start.textContent = formatNumber(summary.test_start_sessions);
  metrics.complete.textContent = formatNumber(summary.test_complete_sessions);
  metrics.completionRate.textContent = formatPercent(summary.completion_rate);
  metrics.resultView.textContent = formatNumber(summary.result_view_sessions);
  metrics.share.textContent = formatNumber(summary.share_action_sessions);

  elements.rollupMeta.textContent = data.meta?.last_rollup_at ? `最后聚合 ${data.meta.last_rollup_at}` : '暂无聚合时间';
  renderFunnel(data.funnel || []);
  renderShare(data.share || {});
  renderQuestions(data.questions || []);
  renderResults(data.results || []);
}

function renderFunnel(steps) {
  if (!steps.length) {
    elements.funnel.innerHTML = '<p class="empty">暂无漏斗数据。</p>';
    return;
  }

  const maxSessions = Math.max(...steps.map((step) => Number(step.session_count) || 0), 1);
  elements.funnel.innerHTML = steps
    .map((step) => {
      const width = Math.round(((Number(step.session_count) || 0) / maxSessions) * 100);
      return `<div class="funnel-row">
        <strong>${escapeHtml(step.label || step.key)}</strong>
        <div class="funnel-bar"><span style="width:${width}%"></span></div>
        <span>${formatNumber(step.session_count)} 会话</span>
        <span>${formatPercent(step.from_previous_rate)}</span>
      </div>`;
    })
    .join('');
}

function renderShare(share) {
  const actionCounts = share.action_counts || {};
  const actionSessions = share.action_sessions || {};
  const rows = Object.keys(actionCounts).sort().map((action) => `<tr>
    <td><strong>${escapeHtml(formatShareAction(action))}</strong><br><small>${escapeHtml(action)}</small></td>
    <td>${formatNumber(actionCounts[action])}</td>
    <td>${formatNumber(actionSessions[action])}</td>
  </tr>`);
  elements.shareBody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="3">暂无分享行为。</td></tr>';
}

function renderQuestions(questions) {
  elements.questionBody.innerHTML = questions.length
    ? questions.map((question) => `<tr>
        <td>${formatNumber(question.question_index)}<br><small>${escapeHtml(question.question_id)}</small></td>
        <td>${formatNumber(question.view_sessions)}</td>
        <td>${formatNumber(question.answer_sessions)}</td>
        <td>${formatPercent(question.answer_rate)}</td>
        <td>${formatDuration(question.avg_time_spent_ms)}</td>
        <td>${formatDistribution(question.option_distribution)}</td>
      </tr>`).join('')
    : '<tr><td colspan="6">暂无题目数据。</td></tr>';
}

function renderResults(results) {
  elements.resultBody.innerHTML = results.length
    ? results.map((result) => `<tr>
        <td>${escapeHtml(result.result_name)}</td>
        <td>${escapeHtml(result.result_type_internal)}</td>
        <td>${formatNumber(result.complete_sessions)}</td>
        <td>${formatPercent(result.share_of_completions)}</td>
        <td>${formatNumber(result.avg_confidence)}</td>
      </tr>`).join('')
    : '<tr><td colspan="5">暂无结果数据。</td></tr>';
}

function formatDistribution(distribution = {}) {
  const entries = Object.entries(distribution);
  if (!entries.length) return '-';
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${escapeHtml(key)}: ${formatNumber(value)}`)
    .join('<br>');
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('is-error', isError);
}

function formatLoadedStatus(data) {
  const range = data.range || {};
  const parts = [`已加载 ${range.from} 至 ${range.to}`, `channel=${range.channel}`];
  if (range.host) parts.push(`host=${range.host}`);
  if (range.contentVersion) parts.push(`contentVersion=${range.contentVersion}`);
  const scope = formatScopeStatus(data.meta || {});
  return `${parts.join('，')}。${scope}`;
}

function formatScopeStatus(meta) {
  if (meta.summary_scope !== 'source_daily') {
    return '核心指标和细分模块按 date + channel 汇总；正式复盘请填写 Host / Content Version。';
  }
  if (meta.source_detail_coverage === 'full') {
    return '核心指标、漏斗、题目、结果和分享明细均已按 Host / Content Version 筛选。';
  }
  if (meta.source_detail_coverage === 'missing' || meta.source_detail_coverage === 'partial') {
    return '核心指标已按 Host / Content Version 筛选；明细字段缺少回填，请重新执行 rollup。';
  }
  if (meta.source_detail_coverage === 'empty') {
    return '未找到匹配的 Host / Content Version 聚合记录；请确认筛选条件或重新执行 rollup。';
  }
  return 'Host / Content Version 筛选已生效。';
}

function formatShareAction(action) {
  const labels = {
    generate_share_image_click: '生成分享图',
    save_image_click: '保存结果图',
    copy_share_click: '复制默认分享文案',
    copy_test_link_click: '复制测试入口',
    platform_share_click: '去平台晒图',
  };
  return labels[action] || action;
}

function getShanghaiDate(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '-';
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : '-';
}

function formatDuration(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '-';
  return `${(number / 1000).toFixed(1)}s`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
