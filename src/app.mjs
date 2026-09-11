import { buildScoreReport } from './scoring.mjs';
import { mergeStateWithChannel } from './channel.mjs';
import {
  buildArchiveCode,
  buildPlatformShareText,
  buildResultSvg,
  buildShareHref,
  buildShareText,
  getResultAvatarSource,
  getVersionedAssetSource,
} from './share.mjs';
import { escapeAttribute, escapeHtml } from './html.mjs';
import {
  createInitialState,
  createLaunchState,
  normalizeSavedState,
  prepareResumeState,
  shouldPreserveResumableProgress,
  STATE_SCHEMA_VERSION,
} from './state.mjs';
import { markChapterCompleteTracked, markTestCompleteTracked } from './tracking-state.mjs';
import { QUIZ_AUTO_ADVANCE_DELAY_MS } from './timing.mjs';
import { flushAnalytics, initAnalytics, track } from './analytics.mjs';
import { chapters, questions } from './data/questions.mjs';
import { questionScenes } from './data/questionScenes.mjs';
import { results } from './data/results.mjs';

const STORAGE_KEY = 'guanghe-gpti-demo';
const ANALYTICS_APP_VERSION = 'pre-p0-2026-05-20';
const CONTENT_VERSION = 'content-2026-06-10-gpti-scoring-calibration-a';
const SHARE_POSTER_QR_HREF = 'https://gameplayti.icu/?h5_channel=share_poster';
const SHARE_POSTER_QR_SOURCE = './assets/qr/gameplayti-official.png';
const SURVEY_HREF = 'https://wj.qq.com/s2/26929947/85d7/';
const PLAYER_GROUP_HREF = 'https://qun.qq.com/certify-share/s/iYIhVvtXJe?_nsp=1';
const PLAYER_GROUP_QR_SOURCE = './assets/qr/guanghe-player-group.png';
const CAMPUS_GROUP_HREF = 'https://qun.qq.com/certify-share/s/Nob8sZR4u5?_nsp=';
const CAMPUS_GROUP_QR_SOURCE = './assets/qr/guanghe-campus-group.png';
const app = document.querySelector('#app');

const sharePlatforms = [
  { id: 'friend_circle', label: '微信朋友圈', hint: '文案已复制。保存图片后，打开微信朋友圈上传图片并粘贴文案。' },
  { id: 'xiaohongshu', label: '小红书', hint: '小红书风格文案已复制。保存图片后，发布图文并粘贴标题/标签。' },
  { id: 'bilibili', label: '哔哩哔哩', hint: 'B 站动态文案已复制。保存图片后，发动态上传图片即可。' },
  { id: 'xiaoheihe', label: '小黑盒', hint: '小黑盒社区文案已复制。保存图片后，发动态上传图片即可。' },
  { id: 'generic', label: '通用分享', hint: '已复制通用分享内容。也可以使用系统分享面板。' },
];

let autoAdvanceTimer = null;
let questionShownAt = 0;
let lastQuestionViewKey = '';
let lastResultViewKey = '';
let resultDetailsOpen = false;
let sideQuestFloatDismissed = false;
let shareOverlayState = {
  isOpen: false,
  platformPanelOpen: false,
  imageUrl: '',
  imageType: 'png',
  toast: '',
};
let communityOverlayState = {
  isOpen: false,
  kind: 'player',
  toast: '',
};
const restoredState = mergeStateWithChannel(
  normalizeSavedState(loadState(), { contentVersion: CONTENT_VERSION, questions }),
  window.location.search,
);
const launchState = createLaunchState(restoredState, { contentVersion: CONTENT_VERSION, questions });
let state = launchState.initialState;
let resumableState = launchState.resumeState;
const runtimeAnalyticsConfig = window.GH_ANALYTICS_CONFIG ?? {};

initAnalytics({
  endpoint: runtimeAnalyticsConfig.endpoint ?? '',
  appVersion: runtimeAnalyticsConfig.appVersion ?? ANALYTICS_APP_VERSION,
  contentVersion: runtimeAnalyticsConfig.contentVersion ?? CONTENT_VERSION,
  channel: state.channel,
  debug: Boolean(runtimeAnalyticsConfig.debug),
  batchSize: runtimeAnalyticsConfig.batchSize ?? 10,
  batchMaxEvents: runtimeAnalyticsConfig.batchMaxEvents ?? 20,
  flushIntervalMs: runtimeAnalyticsConfig.flushIntervalMs ?? 5000,
  maxQueueSize: runtimeAnalyticsConfig.maxQueueSize ?? 100,
  maxSessionEvents: runtimeAnalyticsConfig.maxSessionEvents ?? 200,
});

render();
window.addEventListener('scroll', scheduleSideQuestFloatSync, { passive: true });
window.addEventListener('resize', scheduleSideQuestFloatSync, { passive: true });

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState() {
  state.schemaVersion = STATE_SCHEMA_VERSION;
  state.contentVersion = CONTENT_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  window.clearTimeout(autoAdvanceTimer);
  closeShareOverlay(false);
  closeCommunityOverlay(false);
  lastQuestionViewKey = '';
  lastResultViewKey = '';
  resultDetailsOpen = false;
  sideQuestFloatDismissed = false;
  resumableState = null;
  state = createInitialState({
    channel: state.channel,
    contentVersion: CONTENT_VERSION,
  });
  saveState();
  render();
}

function setView(view) {
  closeShareOverlay(false);
  closeCommunityOverlay(false);
  state.view = view;
  if (!shouldPreserveResumableProgress(state, resumableState)) saveState();
  render();
}

function render() {
  window.clearTimeout(autoAdvanceTimer);
  if (state.view === 'home') return renderHome();
  if (state.view === 'rules') return renderRules();
  if (state.view === 'quiz') return renderQuiz();
  if (state.view === 'chapter') return renderChapterBreak();
  if (state.view === 'generating') return renderGenerating();
  if (state.view === 'result') return renderResult();
}

function renderHome() {
  const resumeButton = resumableState
    ? '<button class="ghost" data-action="resume">继续上次</button>'
    : '<button class="ghost" data-action="resume" disabled aria-disabled="true">继续上次</button>';

  app.innerHTML = `
    <section class="hero screen journey-home">
      <div class="terminal-panel">
        <div class="screen-kicker">
          <span class="orbital-mark">开局路线</span>
          <span class="channel-pill">四章 · 24 题</span>
        </div>
        <div class="hero-title-block">
          <h1>你醒在一座没有地图的城外</h1>
          <p class="subtitle">每次选择都会把路线推向不同职业档案。</p>
        </div>
        <div class="journey-route" aria-label="开局路线">
          <span class="is-active"></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="route-card" aria-label="测试流程">
          <span>第一章：醒来</span>
          <span>第二章：同行</span>
          <span>第三章：危机</span>
          <span>第四章：结算</span>
        </div>
        <div class="actions route-actions">
          <button class="primary" data-action="start">开始冒险</button>
          <div class="split-actions">
            ${resumeButton}
            <button class="ghost" data-action="rules">查看规则</button>
          </div>
        </div>
      </div>
    </section>
  `;

  app.querySelector('[data-action="start"]').addEventListener('click', () => {
    resumableState = null;
    state = createInitialState({
      channel: state.channel,
      contentVersion: CONTENT_VERSION,
    });
    state.startedAt = Date.now();
    track('test_start', {
      page_id: 'home',
      is_resume: false,
      answered_count: 0,
    });
    state.view = 'quiz';
    state.currentIndex = 0;
    saveState();
    render();
  });
  app.querySelector('[data-action="resume"]')?.addEventListener('click', () => {
    if (!resumableState) return;
    state = prepareResumeState(resumableState, questions);
    if (!state.startedAt) {
      state.startedAt = Date.now();
    }
    resumableState = null;
    track('test_start', {
      page_id: 'home',
      is_resume: true,
      answered_count: state.answers.length,
    });
    saveState();
    render();
  });
  app.querySelector('[data-action="rules"]').addEventListener('click', () => {
    track('rules_view', { page_id: 'home', from_page: 'home' });
    setView('rules');
  });
  track('page_view', { page_id: 'home' });
}

function renderRules() {
  app.innerHTML = `
    <section class="screen panel rules-panel">
      <div class="screen-kicker">
        <span class="orbital-mark">NOTICE</span>
        <span class="channel-pill">LOCAL ONLY</span>
      </div>
      <h2>档案局说明</h2>
      <ul class="rule-list">
        <li>本测试为娱乐向游戏人格测试，不是严肃心理测评。</li>
        <li>共 24 题，约 3-5 分钟。</li>
        <li>每个选择都会影响你的异界职业档案。</li>
        <li>本地计算，不上传敏感数据。</li>
        <li>结果仅供自我观察、截图保存和社交分享。</li>
      </ul>
      <button class="primary" data-action="back">返回</button>
    </section>
  `;
  app.querySelector('[data-action="back"]').addEventListener('click', () => setView('home'));
}

function renderQuiz() {
  const question = questions[state.currentIndex];
  if (!question) {
    state.currentIndex = questions.length - 1;
    state.view = 'generating';
    saveState();
    return render();
  }
  const chapter = chapters.find((item) => item.id === question.chapter);
  const scene = questionScenes[question.id];
  const answered = state.answers.find((answer) => answer.questionId === question.id);
  const progress = Math.round(((state.currentIndex + 1) / questions.length) * 100);

  app.innerHTML = `
    <section class="screen quiz ${scene ? 'quiz-with-scene' : ''} ${answered ? 'quiz-answered' : 'quiz-fresh'}">
      <div class="quiz-top">
        <span>${escapeHtml(chapter.title)}</span>
        <span>${String(state.currentIndex + 1).padStart(2, '0')} / ${questions.length}</span>
      </div>
      <div class="chapter-progress journey-route" aria-label="章节进度">
        ${chapters.map((item) => `<span class="${item.id <= chapter.id ? 'is-active' : ''}"></span>`).join('')}
      </div>
      ${renderQuestionPrompt(question, scene)}
      <div class="choices">
        ${renderChoiceButtons(question, answered)}
      </div>
      <div class="nav-row">
        <button class="ghost" data-action="prev" ${state.currentIndex === 0 ? 'disabled' : ''}>上一题</button>
        <button class="primary" data-action="next" ${answered ? '' : 'disabled'}>${state.currentIndex === questions.length - 1 ? '生成档案' : '下一题'}</button>
      </div>
    </section>
  `;

  app.querySelectorAll('[data-option-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const option = question.options.find((item) => item.id === button.dataset.optionId);
      if (option) answerQuestion(question, option, true);
    });
  });
  app.querySelector('[data-action="prev"]').addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      saveState();
      render();
    }
  });
  app.querySelector('[data-action="next"]').addEventListener('click', advance);
  const questionViewKey = `${state.currentIndex}:${question.id}`;
  if (questionViewKey !== lastQuestionViewKey) {
    track('question_view', {
      page_id: 'quiz',
      question_id: question.id,
      question_index: state.currentIndex + 1,
      chapter: question.chapter,
      option_count: question.options.length,
    });
    questionShownAt = Date.now();
    lastQuestionViewKey = questionViewKey;
  }
}

function renderQuestionPrompt(question, scene) {
  if (!scene) {
    return `<div class="question-panel">
      <p class="micro-label">路口事件</p>
      <h2>${escapeHtml(question.title)}</h2>
    </div>`;
  }

  const illustration = scene.illustration
    ? `<figure class="question-illustration">
        <img src="${escapeAttribute(scene.illustration)}" alt="${escapeAttribute(scene.alt || '')}" decoding="async" />
      </figure>`
    : '';
  const paragraphs = Array.isArray(scene.paragraphs)
    ? scene.paragraphs.map((item) => `<p>${escapeHtml(item)}</p>`).join('')
    : `<p>${escapeHtml(question.title)}</p>`;
  const callouts = Array.isArray(scene.callouts)
    ? scene.callouts.map((item) => `<section class="question-callout">
        <p class="question-callout-label">${escapeHtml(item.label)}</p>
        ${item.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
      </section>`).join('')
    : '';
  const prompt = scene.prompt ? `<p class="question-prompt">${escapeHtml(scene.prompt)}</p>` : '';

  return `<div class="question-panel question-panel-scene">
    ${illustration}
    <div class="question-copy">
      <p class="micro-label">路口事件</p>
      <h2>${escapeHtml(scene.title || question.title)}</h2>
      <div class="question-narrative">
        ${paragraphs}
        ${callouts}
        ${prompt}
      </div>
    </div>
  </div>`;
}

function renderChoiceButtons(question, answered) {
  return question.options
    .map((option, index) => {
      const selected = answered?.optionId === option.id ? ' selected' : '';
      return `<button class="choice${selected}" data-option-id="${escapeAttribute(option.id)}" style="--choice-index:${index}">
        <span class="choice-prefix">${escapeHtml(option.id.toUpperCase())}</span>
        <span class="choice-text">${escapeHtml(option.text)}</span>
      </button>`;
    })
    .join('');
}

function answerQuestion(question, option, shouldAutoAdvance = false) {
  const answeredIndex = state.currentIndex;
  const existingIndex = state.answers.findIndex((answer) => answer.questionId === question.id);
  const isChange = existingIndex >= 0;
  const timeSpentMs = questionShownAt ? Math.max(0, Date.now() - questionShownAt) : 0;
  const answer = {
    questionId: question.id,
    optionId: option.id,
    keywords: option.keywords,
    poles: option.poles,
    answeredAt: Date.now(),
  };

  if (existingIndex >= 0) {
    state.answers[existingIndex] = answer;
  } else {
    state.answers.push(answer);
  }

  saveState();
  track('question_answer', {
    page_id: 'quiz',
    question_id: question.id,
    question_index: answeredIndex + 1,
    chapter: question.chapter,
    option_id: answer.optionId,
    keywords: option.keywords,
    poles: option.poles,
    time_spent_ms: timeSpentMs,
    is_change: isChange,
  });
  render();

  if (shouldAutoAdvance) {
    autoAdvanceTimer = window.setTimeout(() => {
      const latestAnswer = state.answers.find((answer) => answer.questionId === question.id);
      if (latestAnswer?.optionId === option.id && state.view === 'quiz' && state.currentIndex === answeredIndex) {
        advance();
      }
    }, QUIZ_AUTO_ADVANCE_DELAY_MS);
  }
}

function advance() {
  const isLast = state.currentIndex === questions.length - 1;
  const currentQuestion = questions[state.currentIndex];
  const nextQuestion = questions[state.currentIndex + 1];
  const isChapterEnd = !isLast && currentQuestion?.chapter !== nextQuestion?.chapter;

  if (isLast) {
    state.view = 'generating';
  } else if (isChapterEnd) {
    state.view = 'chapter';
  } else {
    state.currentIndex += 1;
  }

  saveState();
  render();
}

function renderChapterBreak() {
  const completedChapter = chapters.find((item) => item.id === questions[state.currentIndex].chapter);
  const tracking = markChapterCompleteTracked(state, completedChapter.id);
  state = tracking.state;
  saveState();
  app.innerHTML = `
    <section class="screen panel chapter-break">
      <div class="chapter-seal" aria-hidden="true">封存</div>
      <div class="chapter-rune">CHAPTER ${completedChapter.id}</div>
      <h2>${escapeHtml(completedChapter.feedback)}</h2>
      <p>档案正在变厚。继续往前走，别让这个世界以为你怂了。</p>
      <button class="primary" data-action="continue">继续冒险</button>
    </section>
  `;
  app.querySelector('[data-action="continue"]').addEventListener('click', () => {
    state.currentIndex += 1;
    state.view = 'quiz';
    saveState();
    render();
  });
  if (tracking.shouldTrack) {
    track('chapter_complete', {
      page_id: 'quiz',
      chapter: completedChapter.id,
      answered_count: state.answers.length,
      duration_ms: getTestDurationMs(),
    });
  }
}

function renderGenerating() {
  app.innerHTML = `
    <section class="screen panel generating">
      <div class="archive-loader" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <h2>命运档案封存中</h2>
      <div class="status-list" aria-label="档案生成状态">
        <p style="--status-index:0">正在读取你的 24 次选择</p>
        <p style="--status-index:1">正在比对异界职业谱系</p>
        <p style="--status-index:2">正在生成你的游戏灵魂职业</p>
      </div>
    </section>
  `;

  const report = buildScoreReport(questions, state.answers);
  const result = results[report.type] ?? results.ATRB;
  const tracking = markTestCompleteTracked(state);
  state = tracking.state;
  saveState();
  if (tracking.shouldTrack) {
    track('test_complete', {
      page_id: 'generating',
      duration_ms: getTestDurationMs(),
      result_type_internal: report.type,
      result_name: result.name,
      hidden_trait_id: report.hiddenTrait?.id ?? '',
      hidden_trait_name: report.hiddenTrait?.name ?? '',
      confidence_avg: getConfidenceAverage(report),
      low_confidence_count: getLowConfidenceCount(report),
    });
    void flushAnalytics();
  }
  window.setTimeout(() => {
    state.view = 'result';
    sideQuestFloatDismissed = false;
    saveState();
    render();
  }, 1600);
}

function renderResult() {
  const report = buildScoreReport(questions, state.answers);
  const result = results[report.type] ?? results.ATRB;
  app.innerHTML = `
    <section class="screen result-screen">
      ${renderResultCard(result, report)}
    </section>
    ${renderSideQuestFloat()}
    ${shareOverlayState.isOpen ? renderShareOverlay(result, report) : ''}
    ${communityOverlayState.isOpen ? renderCommunityOverlay() : ''}
  `;

  app.querySelector('[data-action="share-image"]').addEventListener('click', () => openShareOverlay(result, report));
  app.querySelector('[data-action="toggle-details"]').addEventListener('click', () => {
    resultDetailsOpen = !resultDetailsOpen;
    renderResult();
  });
  app.querySelector('[data-action="copy"]').addEventListener('click', () => copyShareText(result));
  bindSideQuestActions();
  app.querySelector('[data-action="restart"]').addEventListener('click', () => {
    track('restart_click', {
      page_id: 'result',
      from_result_name: result.name,
      answered_count: state.answers.length,
    });
    void flushAnalytics();
    resetState();
  });
  if (shareOverlayState.isOpen) {
    bindShareOverlayActions(result, report);
  }
  if (communityOverlayState.isOpen) {
    bindCommunityOverlayActions();
  }
  scheduleSideQuestFloatSync();
  const resultViewKey = `${report.type}:${buildArchiveCode(state.answers.length)}`;
  if (lastResultViewKey !== resultViewKey) {
    lastResultViewKey = resultViewKey;
    track('result_view', {
      page_id: 'result',
      result_type_internal: report.type,
      result_name: result.name,
      hidden_trait_id: report.hiddenTrait?.id ?? '',
      hidden_trait_name: report.hiddenTrait?.name ?? '',
      archive_code: buildArchiveCode(state.answers.length),
      confidence_avg: getConfidenceAverage(report),
    });
    void flushAnalytics();
  }
}

function renderResultCard(result, report) {
  const archiveCode = buildArchiveCode(state.answers.length);
  const stability = getArchiveStability(report);
  const hiddenTrait = report.hiddenTrait;
  const bestPartners = getResultNameList(result.bestPartners);
  const nemesis = getResultNameList(result.nemesis);
  const hiddenTraitName = hiddenTrait ? escapeHtml(hiddenTrait.name) : escapeHtml(result.talent);
  const hiddenTraitHeadline = hiddenTrait ? escapeHtml(hiddenTrait.headline) : '';

  return `
    <article id="result-card" class="result-card" data-archive="${escapeAttribute(archiveCode)}" data-rarity="${escapeAttribute(result.rarity)}">
      <div class="card-meta">
        <span class="orbital-mark">旅程结算</span>
        <span>NO. ${escapeHtml(archiveCode)}</span>
      </div>
      <div class="result-hero">
        ${renderAvatarFrame(result)}
        <h1>${escapeHtml(result.name)}</h1>
        <p class="headline">${escapeHtml(result.headline)}</p>
      </div>
      <div class="result-mini-grid">
        <p><strong>职业谱系</strong>${escapeHtml(result.identity)}</p>
        <p><strong>隐藏特质</strong>${hiddenTraitName}${hiddenTraitHeadline ? `<span>${hiddenTraitHeadline}</span>` : ''}</p>
      </div>
      <section class="journey-summary">
        <p>${escapeHtml(result.summary)}</p>
      </section>
      <div class="actions result-actions">
        <button class="primary" data-action="share-image">生成分享图</button>
      </div>
      <p class="hint">生成适合长按保存、发朋友圈/小红书/社区动态的分享图。不会承诺一键发布到第三方平台。</p>
      <button class="ghost details-toggle" data-action="toggle-details" aria-expanded="${resultDetailsOpen ? 'true' : 'false'}">
        ${resultDetailsOpen ? '收起人格细节' : '查看人格细节'}
      </button>
      ${resultDetailsOpen ? renderResultDetails(result) : ''}
      <p class="confidence">档案稳定度 ${stability}% · 适配队友 ${escapeHtml(bestPartners)} · 天敌队友 ${escapeHtml(nemesis)}</p>
      <div class="actions result-secondary-actions">
        <button class="ghost" data-action="copy">复制分享文案</button>
        <button class="ghost" data-action="restart">重新测试</button>
      </div>
      ${renderSideQuestPanel()}
    </article>
  `;
}

function renderSideQuestFloat() {
  if (sideQuestFloatDismissed || shareOverlayState.isOpen || communityOverlayState.isOpen) return '';

  return `
    <aside class="side-quest-float" aria-label="支线任务悬浮提示">
      <span>支线任务：问卷抽周边 · 加玩家群</span>
      <button class="ghost" data-action="scroll-side-quest">去看看</button>
    </aside>
  `;
}

function renderSideQuestPanel() {
  return `
    <section class="side-quest-panel" aria-labelledby="side-quest-title">
      <p class="side-quest-kicker">SIDE QUEST / 支线任务</p>
      <h2 id="side-quest-title">先不要关QAQ，你的职业档案还有支线任务</h2>
      <button class="primary side-quest-survey" data-action="open-survey">填问卷，参与周边抽奖</button>
      <div class="side-quest-grid">
        <article class="side-quest-card">
          <div>
            <h3>玩家交流群</h3>
            <p>晒结果 / 找同类职业 / 后续活动</p>
          </div>
          <div class="side-quest-actions">
            <button class="ghost" data-action="open-community-qr" data-community="player">查看玩家群二维码</button>
            <button class="ghost" data-action="copy-community-link" data-community="player">复制群链接</button>
          </div>
        </article>
        <article class="side-quest-card">
          <div>
            <h3>高校群</h3>
            <p>光核训练营实习 / 高校伙伴交流 / 活动通知</p>
          </div>
          <div class="side-quest-actions">
            <button class="ghost" data-action="open-community-qr" data-community="campus">查看高校群二维码</button>
            <button class="ghost" data-action="copy-community-link" data-community="campus">复制群链接</button>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderResultDetails(result) {
  const detail = result.detail;
  if (!detail) return '';
  const detailSection = (title, items = []) => {
    const visibleItems = items.filter((item) => typeof item === 'string' && item.trim());
    if (!visibleItems.length) return '';

    return `
    <section class="detail-section">
      <h2>${escapeHtml(title)}</h2>
      ${visibleItems.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}
    </section>
  `;
  };

  return `
    <div class="result-details">
      ${detailSection('人格画像', detail.analysis)}
      ${detailSection('玩家翻译', detail.behavior)}
      ${detailSection('游戏行为罪状', detail.charges)}
      ${detailSection('隐藏天赋', detail.talents)}
      ${detailSection('致命弱点', detail.weaknesses)}
      ${detailSection('灵魂化身', detail.soul)}
      ${detailSection('适配队友', detail.partners)}
      ${detailSection('天敌队友', detail.nemesis)}
    </div>
  `;
}

function renderAvatarFrame(result) {
  const avatar = getResultAvatarSource(result, CONTENT_VERSION);
  const placeholder = `<div class="avatar-placeholder">${escapeHtml(result.name.slice(0, 2))}</div>`;
  if (!avatar) return `<div class="avatar-frame">${placeholder}</div>`;

  return `<div class="avatar-frame">
    <img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(`${result.name} 头像`)}" onerror="this.hidden=true; this.nextElementSibling.hidden=false" />
    <div class="avatar-placeholder" hidden>${escapeHtml(result.name.slice(0, 2))}</div>
  </div>`;
}

function getResultNameList(typeKeys = []) {
  return typeKeys.map((type) => results[type]?.name).filter(Boolean).join('、') || '待匹配';
}

function getArchiveStability(report) {
  const values = Object.values(report.confidence ?? {});
  if (!values.length) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(average * 100);
}

function getConfidenceAverage(report) {
  const values = Object.values(report.confidence ?? {});
  if (!values.length) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number(average.toFixed(2));
}

function getLowConfidenceCount(report) {
  return Object.values(report.confidence ?? {}).filter((value) => value < 0.25).length;
}

function getTestDurationMs() {
  return state.startedAt ? Math.max(0, Date.now() - state.startedAt) : 0;
}

function renderShareOverlay(result, report) {
  const platformPanel = shareOverlayState.platformPanelOpen
    ? `<div class="platform-panel" aria-label="平台晒图面板">
        <p class="share-note">先保存图片，再复制适合平台的文案。H5 无法稳定一键发布到第三方平台。</p>
        <div class="platform-list">
          ${sharePlatforms
            .map(
              (platform) => `<button class="platform-button" data-platform="${escapeAttribute(platform.id)}">
                <span>${escapeHtml(platform.label)}</span>
                <small>${platform.id === 'generic' ? '系统分享或复制链接' : '复制文案与操作提示'}</small>
              </button>`
            )
            .join('')}
        </div>
      </div>`
    : '';

  const preview = shareOverlayState.imageUrl
    ? `<img class="share-preview-image" src="${escapeAttribute(shareOverlayState.imageUrl)}" alt="${escapeAttribute(`${result.name} 分享图预览`)}" />`
    : `<div class="share-preview-loading">正在生成分享图...</div>`;

  return `
    <div class="share-overlay" role="dialog" aria-modal="true" aria-label="分享图预览">
      <div class="share-backdrop" data-action="close-share"></div>
      <div class="share-sheet">
        <div class="share-sheet-head">
          <div>
            <p class="eyebrow">SHARE ARCHIVE</p>
            <h2>分享档案已生成</h2>
          </div>
          <button class="icon-button" data-action="close-share" aria-label="关闭分享图预览">×</button>
        </div>
        <div class="share-preview">
          ${preview}
        </div>
        <p class="share-note">移动端可长按预览图保存；分享图会带上正式入口和玩家群二维码，若下载被浏览器拦截，请使用长按保存。</p>
        <div class="share-actions">
          <button class="primary" data-action="save-share-image">保存图片</button>
          <button class="ghost" data-action="toggle-platform-panel">去平台晒图</button>
          <button class="ghost" data-action="go-side-quest">去支线任务</button>
          <button class="ghost" data-action="copy-test-link">复制测试链接</button>
        </div>
        ${platformPanel}
        ${shareOverlayState.toast ? `<p class="share-toast" role="status">${escapeHtml(shareOverlayState.toast)}</p>` : ''}
      </div>
    </div>
  `;
}

function getCommunityConfig(kind) {
  if (kind === 'campus') {
    return {
      kind: 'campus',
      title: '高校群',
      description: '了解光核训练营实习、高校伙伴交流和活动通知。',
      href: CAMPUS_GROUP_HREF,
      qrSource: CAMPUS_GROUP_QR_SOURCE,
      copiedText: '高校群链接已复制。',
    };
  }

  return {
    kind: 'player',
    title: '玩家交流群',
    description: '晒结果、找同类职业、参加后续活动。',
    href: PLAYER_GROUP_HREF,
    qrSource: PLAYER_GROUP_QR_SOURCE,
    copiedText: '玩家群链接已复制。',
  };
}

function renderCommunityOverlay() {
  const config = getCommunityConfig(communityOverlayState.kind);
  const qrSource = getVersionedAssetSource(config.qrSource, CONTENT_VERSION);

  return `
    <div class="community-overlay" role="dialog" aria-modal="true" aria-label="${escapeAttribute(config.title)}二维码">
      <div class="community-backdrop" data-action="close-community"></div>
      <div class="community-sheet">
        <div class="community-sheet-head">
          <div>
            <p class="eyebrow">COMMUNITY PORTAL</p>
            <h2>${escapeHtml(config.title)}</h2>
          </div>
          <button class="icon-button" data-action="close-community" aria-label="关闭社群二维码">×</button>
        </div>
        <p class="community-copy">${escapeHtml(config.description)}</p>
        <img class="community-qr" src="${escapeAttribute(qrSource)}" alt="${escapeAttribute(`${config.title}二维码`)}" />
        <p class="community-copy">长按识别二维码，或复制群链接。</p>
        <div class="community-actions">
          <button class="primary" data-action="copy-community-link" data-community="${escapeAttribute(config.kind)}">复制群链接</button>
          <button class="ghost" data-action="close-community">返回结果页</button>
        </div>
        ${communityOverlayState.toast ? `<p class="community-toast" role="status">${escapeHtml(communityOverlayState.toast)}</p>` : ''}
      </div>
    </div>
  `;
}

function bindSideQuestActions() {
  app.querySelectorAll('[data-action="scroll-side-quest"]').forEach((button) => {
    button.addEventListener('click', () => scrollToSideQuest());
  });
  app.querySelector('[data-action="open-survey"]')?.addEventListener('click', () => {
    openExternalHref(SURVEY_HREF);
  });
  app.querySelectorAll('[data-action="open-community-qr"]').forEach((button) => {
    button.addEventListener('click', () => openCommunityOverlay(button.dataset.community));
  });
  app.querySelectorAll('[data-action="copy-community-link"]').forEach((button) => {
    button.addEventListener('click', () => copyCommunityLink(button.dataset.community));
  });
}

function bindCommunityOverlayActions() {
  app.querySelectorAll('[data-action="close-community"]').forEach((button) => {
    button.addEventListener('click', () => closeCommunityOverlay());
  });
}

function openCommunityOverlay(kind = 'player') {
  closeShareOverlay(false);
  communityOverlayState = {
    isOpen: true,
    kind: kind === 'campus' ? 'campus' : 'player',
    toast: '',
  };
  renderResult();
}

function closeCommunityOverlay(shouldRender = true) {
  communityOverlayState = {
    isOpen: false,
    kind: 'player',
    toast: '',
  };
  if (shouldRender) renderResult();
}

function bindShareOverlayActions(result, report) {
  app.querySelectorAll('[data-action="close-share"]').forEach((button) => {
    button.addEventListener('click', () => closeShareOverlay());
  });
  app.querySelector('[data-action="save-share-image"]').addEventListener('click', () => saveShareImage(result, report));
  app.querySelector('[data-action="toggle-platform-panel"]').addEventListener('click', () => {
    shareOverlayState = {
      ...shareOverlayState,
      platformPanelOpen: !shareOverlayState.platformPanelOpen,
      toast: '',
    };
    renderResult();
  });
  app.querySelector('[data-action="copy-test-link"]').addEventListener('click', () => copyTestLink(result));
  app.querySelector('[data-action="go-side-quest"]')?.addEventListener('click', () => goToSideQuestFromShare());
  app.querySelectorAll('[data-platform]').forEach((button) => {
    button.addEventListener('click', () => shareToPlatform(result, report, button.dataset.platform));
  });
}

async function openShareOverlay(result, report) {
  const href = getShareHref();
  shareOverlayState = {
    isOpen: true,
    platformPanelOpen: false,
    imageUrl: '',
    imageType: 'png',
    toast: '正在生成分享图...',
  };
  renderResult();

  const image = await buildResultImage(result, report, href);
  shareOverlayState = {
    isOpen: true,
    platformPanelOpen: false,
    imageUrl: image.url,
    imageType: image.type,
    toast: image.type === 'png' ? '分享图已生成，可保存或长按图片。' : '当前浏览器已使用 SVG 预览作为备用保存方案。',
  };
  renderResult();
  track('generate_share_image_click', {
    page_id: 'result',
    result_type_internal: result.type,
    result_name: result.name,
    hidden_trait_id: report.hiddenTrait?.id ?? '',
    image_type: image.type,
  });
  track('share_overlay_view', {
    page_id: 'result',
    result_name: result.name,
    hidden_trait_id: report.hiddenTrait?.id ?? '',
    image_type: image.type,
  });
  if (image.type === 'svg') {
    track('share_image_fallback', {
      page_id: 'result',
      result_name: result.name,
      reason: 'canvas_generation_failed',
    });
  }
  void flushAnalytics();
}

function closeShareOverlay(shouldRender = true) {
  shareOverlayState = {
    isOpen: false,
    platformPanelOpen: false,
    imageUrl: '',
    imageType: 'png',
    toast: '',
  };
  if (shouldRender) renderResult();
}

function scrollToSideQuest() {
  sideQuestFloatDismissed = true;
  app.querySelector('.side-quest-float')?.remove();
  app.querySelector('.side-quest-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scheduleSideQuestFloatSync() {
  window.requestAnimationFrame(syncSideQuestFloatVisibility);
}

function syncSideQuestFloatVisibility() {
  const float = app.querySelector('.side-quest-float');
  if (!float || sideQuestFloatDismissed) return;

  const panel = app.querySelector('.side-quest-panel');
  if (!panel) return;

  const rect = panel.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const panelVisible = rect.bottom > 16 && rect.top < viewportHeight - 16;
  const shouldShowFloat = !panelVisible;
  float.classList.toggle('is-visible', shouldShowFloat);
}

function goToSideQuestFromShare() {
  closeShareOverlay(false);
  renderResult();
  requestAnimationFrame(scrollToSideQuest);
}

function getShareHref() {
  return buildShareHref(window.location.href, state.channel);
}

function openExternalHref(href) {
  const opened = window.open(href, '_blank');
  if (opened) {
    opened.opener = null;
    return;
  }
  if (!opened) window.location.href = href;
}

async function copyTestLink(result) {
  const href = getShareHref();
  const copied = await copyText(href);
  track('copy_test_link_click', {
    page_id: 'result',
    result_name: result.name,
    channel: state.channel,
    share_url_has_channel: href.includes('h5_channel='),
  });
  if (copied) {
    showShareToast('测试链接已复制，并保留当前渠道参数。');
  } else {
    track('copy_failed', {
      page_id: 'result',
      target: 'test_link',
    });
    window.prompt('复制失败，请长按复制以下链接', href);
  }
  void flushAnalytics();
}

async function copyCommunityLink(kind = 'player') {
  const config = getCommunityConfig(kind);
  const copied = await copyText(config.href);
  if (copied) {
    if (communityOverlayState.isOpen) {
      communityOverlayState = {
        ...communityOverlayState,
        toast: config.copiedText,
      };
      renderResult();
    } else {
      alert(config.copiedText);
    }
    return;
  }

  window.prompt('复制失败，请长按复制以下链接', config.href);
}

async function shareToPlatform(result, report, platformId) {
  const href = getShareHref();

  if (platformId === 'generic' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: '异界开局人格测试',
        text: buildShareText(result, href),
        url: href,
      });
      track('platform_share_click', {
        page_id: 'result',
        platform: platformId,
        result_type_internal: result.type,
        result_name: result.name,
        hidden_trait_id: report.hiddenTrait?.id ?? '',
        image_type: shareOverlayState.imageType,
      });
      showShareToast('已打开系统分享面板。若平台不支持图片，请先保存图片后再发布。');
      void flushAnalytics();
      return;
    } catch {
      // 用户取消系统分享时，继续走复制兜底。
    }
  }

  const text = buildPlatformShareText(result, report, href, platformId);
  const copied = await copyText(text);
  const platform = sharePlatforms.find((item) => item.id === platformId);
  track('platform_share_click', {
    page_id: 'result',
    platform: platformId,
    result_type_internal: result.type,
    result_name: result.name,
    hidden_trait_id: report.hiddenTrait?.id ?? '',
    image_type: shareOverlayState.imageType,
  });
  if (copied) {
    showShareToast(platform?.hint ?? '分享文案已复制。');
  } else {
    track('copy_failed', {
      page_id: 'result',
      target: `platform_${platformId}`,
    });
    window.prompt('复制失败，请长按复制以下文案', text);
  }
  void flushAnalytics();
}

function showShareToast(message) {
  shareOverlayState = {
    ...shareOverlayState,
    toast: message,
  };
  renderResult();
}

function saveShareImage(result, report) {
  if (!shareOverlayState.imageUrl) {
    showShareToast('分享图还在生成中，请稍等一下。');
    return;
  }

  const link = document.createElement('a');
  const extension = shareOverlayState.imageType === 'svg' ? 'svg' : 'png';
  link.href = shareOverlayState.imageUrl;
  link.download = `${buildArchiveCode(state.answers.length).toLowerCase()}-${sanitizeFilename(result.name)}-share.${extension}`;
  link.click();
  track('save_image_click', {
    page_id: 'result',
    result_type_internal: result.type,
    result_name: result.name,
    hidden_trait_id: report.hiddenTrait?.id ?? '',
    image_type: shareOverlayState.imageType,
  });
  void flushAnalytics();
  showShareToast('已尝试保存图片。若浏览器没有下载，请长按预览图保存。');
}

function sanitizeFilename(value) {
  return String(value)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

async function buildResultImage(result, report, href) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    const [avatarImage, qrImage, playerGroupQrImage] = await Promise.all([
      loadShareAvatar(result),
      loadShareQr(SHARE_POSTER_QR_SOURCE),
      loadShareQr(PLAYER_GROUP_QR_SOURCE),
    ]);
    drawSharePoster(
      ctx,
      result,
      { ...report, answerCount: state.answers.length },
      avatarImage,
      qrImage,
      playerGroupQrImage,
    );
    return {
      type: 'png',
      url: canvas.toDataURL('image/png'),
    };
  } catch {
    return {
      type: 'svg',
      url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildResultSvg(result, report, href))}`,
    };
  }
}

function loadShareAvatar(result) {
  const avatar = getResultAvatarSource(result, CONTENT_VERSION);
  return loadShareImage(avatar);
}

function loadShareQr(source) {
  return loadShareImage(getVersionedAssetSource(source, CONTENT_VERSION));
}

function loadShareImage(source) {
  if (!source) return Promise.resolve(null);

  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function drawSharePoster(ctx, result, report, avatarImage = null, qrImage = null, playerGroupQrImage = null) {
  const archiveCode = buildArchiveCode(report.answerCount);
  ctx.fillStyle = '#11181b';
  ctx.fillRect(0, 0, 1080, 1600);

  const background = ctx.createLinearGradient(0, 0, 1080, 1600);
  background.addColorStop(0, '#263531');
  background.addColorStop(0.58, '#162124');
  background.addColorStop(1, '#0e1517');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1080, 1600);

  ctx.strokeStyle = 'rgba(247, 243, 234, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 80; x < 1000; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 80);
    ctx.lineTo(x, 1520);
    ctx.stroke();
  }

  roundRect(ctx, 58, 58, 964, 1484, 42);
  ctx.fillStyle = '#17201d';
  ctx.fill();
  ctx.strokeStyle = '#d9bd78';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#d9bd78';
  ctx.font = '700 34px "Microsoft YaHei", sans-serif';
  ctx.fillText('旅程结算 / ROUTE 24', 92, 140);
  ctx.fillStyle = 'rgba(247, 243, 234, 0.64)';
  ctx.font = '28px "Microsoft YaHei", sans-serif';
  ctx.fillText(`NO. ${archiveCode}`, 742, 140);

  ctx.fillStyle = '#d9bd78';
  ctx.font = '700 36px "Microsoft YaHei", sans-serif';
  ctx.fillText(`${result.rarity} · 职业谱系 · ${result.identity}`, 92, 220);

  drawShareAvatar(ctx, result, avatarImage);

  ctx.fillStyle = '#f6f0e4';
  ctx.font = '800 78px "Microsoft YaHei", sans-serif';
  const nameLines = drawWrappedCanvasText(ctx, result.name, 392, 348, 560, 88, 2);
  ctx.fillStyle = '#d8ded2';
  ctx.font = '700 36px "Microsoft YaHei", sans-serif';
  const headlineY = 348 + (Math.max(nameLines, 1) - 1) * 88 + 72;
  const headlineLines = drawWrappedCanvasText(ctx, result.headline, 392, headlineY, 560, 48, 3);

  const headlineBottom = headlineY + (Math.max(headlineLines, 1) - 1) * 48;
  const tagBottom = drawPosterTags(ctx, result.tags.slice(0, 5), Math.max(610, headlineBottom + 54));

  let y = Math.max(760, tagBottom + 90);
  y = drawPosterBlock(ctx, '短解释', result.summary, y);
  if (report.hiddenTrait) {
    y = drawPosterBlock(ctx, '隐藏特质', `${report.hiddenTrait.name}｜${report.hiddenTrait.headline}`, y + 20);
  }
  y = drawPosterBlock(ctx, '系统罪状', result.charges.slice(0, 2).join(' / '), y + 20);
  y = drawPosterBlock(ctx, '隐藏天赋', result.talent, y + 20, { maxWidth: 690, maxLines: 2 });

  ctx.fillStyle = '#d9bd78';
  ctx.font = '700 34px "Microsoft YaHei", sans-serif';
  ctx.fillText('gameplayti.icu', 92, 1470);

  drawPosterQr(ctx, [
    { image: qrImage, label: '进入测试', fallback: '入口' },
    { image: playerGroupQrImage, label: '玩家群', fallback: '群' },
  ]);
}

function drawPosterTags(ctx, tags, startY) {
  let tagX = 92;
  let tagY = startY;
  ctx.font = '700 30px "Microsoft YaHei", sans-serif';
  for (const tag of tags) {
    const label = `#${tag}`;
    const width = ctx.measureText(label).width + 34;
    if (tagX + width > 988) {
      tagX = 92;
      tagY += 56;
    }
    roundRect(ctx, tagX, tagY - 34, width, 44, 6);
    ctx.fillStyle = '#d9bd78';
    ctx.fill();
    ctx.fillStyle = '#17201d';
    ctx.fillText(label, tagX + 17, tagY);
    tagX += width + 14;
  }
  return tagY + 10;
}

function drawPosterQr(ctx, entries) {
  const qrEntries = Array.isArray(entries) ? entries : [{ image: entries, label: '进入测试', fallback: '入口' }];
  const frameY = 1328;
  const frameWidth = 150;
  const frameHeight = 190;
  const qrSize = 124;
  const gap = 16;
  const totalWidth = qrEntries.length * frameWidth + (qrEntries.length - 1) * gap;
  const startX = 988 - totalWidth;

  qrEntries.forEach((entry, index) => {
    const frameX = startX + index * (frameWidth + gap);
    drawPosterQrEntry(ctx, frameX, frameY, frameWidth, frameHeight, qrSize, entry);
  });
}

function drawPosterQrEntry(ctx, frameX, frameY, frameWidth, frameHeight, qrSize, entry) {
  const qrX = frameX + 13;
  const qrY = frameY + 12;

  roundRect(ctx, frameX, frameY, frameWidth, frameHeight, 14);
  ctx.fillStyle = '#f7f3ea';
  ctx.fill();
  ctx.strokeStyle = 'rgba(217, 189, 120, 0.72)';
  ctx.lineWidth = 3;
  ctx.stroke();

  if (entry.image) {
    ctx.drawImage(entry.image, qrX, qrY, qrSize, qrSize);
  } else {
    ctx.fillStyle = '#17201d';
    ctx.font = '700 26px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entry.fallback, frameX + frameWidth / 2, qrY + 72);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = '#17201d';
  ctx.font = '700 24px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(entry.label, frameX + frameWidth / 2, 1504);
  ctx.textAlign = 'left';
}

function drawShareAvatar(ctx, result, avatarImage) {
  ctx.save();
  roundRect(ctx, 92, 270, 260, 260, 18);
  ctx.fillStyle = avatarImage ? '#f7f5ed' : 'rgba(217, 189, 120, 0.1)';
  ctx.fill();
  ctx.strokeStyle = '#d9bd78';
  ctx.lineWidth = 5;
  ctx.stroke();

  if (avatarImage) {
    ctx.clip();
    const maxWidth = 224;
    const maxHeight = 224;
    const scale = Math.min(maxWidth / avatarImage.naturalWidth, maxHeight / avatarImage.naturalHeight);
    const width = avatarImage.naturalWidth * scale;
    const height = avatarImage.naturalHeight * scale;
    const x = 92 + (260 - width) / 2;
    const y = 270 + (260 - height) / 2;
    ctx.drawImage(avatarImage, x, y, width, height);
    ctx.restore();
    return;
  }

  ctx.fillStyle = '#263531';
  ctx.font = '800 96px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(result.name.slice(0, 2), 222, 425);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawPosterBlock(ctx, title, content, y, options = {}) {
  const maxWidth = options.maxWidth ?? 890;
  const maxLines = options.maxLines ?? 3;
  ctx.fillStyle = '#d9bd78';
  ctx.font = '700 30px "Microsoft YaHei", sans-serif';
  ctx.fillText(title, 92, y);
  ctx.fillStyle = '#f6f0e4';
  ctx.font = '32px "Microsoft YaHei", sans-serif';
  const lines = drawWrappedCanvasText(ctx, content, 92, y + 54, maxWidth, 46, maxLines);
  return y + 70 + lines * 46;
}

function drawWrappedCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const tokens = tokenizeCanvasText(text);
  const lines = [];
  let line = '';

  for (const token of tokens) {
    const nextToken = line ? token : token.trimStart();
    const next = `${line}${nextToken}`;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line.trimEnd());
      line = nextToken.trimStart();
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }

    if (ctx.measureText(line).width > maxWidth) {
      line = splitOversizedCanvasLine(ctx, line, maxWidth, lines, maxLines);
      if (lines.length === maxLines) break;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line.trimEnd());
  }

  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  return lines.length;
}

function tokenizeCanvasText(text) {
  return String(text).match(/[A-Za-z0-9]+(?:[.'-][A-Za-z0-9]+)*\s*|\s+|[^\sA-Za-z0-9]/g) ?? [];
}

function splitOversizedCanvasLine(ctx, text, maxWidth, lines, maxLines) {
  let line = '';
  for (const char of Array.from(text)) {
    const next = `${line}${char}`;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line.trimEnd());
      if (lines.length === maxLines) return '';
      line = char.trimStart();
    } else {
      line = next;
    }
  }
  return line;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

async function copyShareText(result) {
  const text = buildShareText(result, getShareHref());
  const copied = await copyText(text);
  track('copy_share_click', {
    page_id: 'result',
    result_type_internal: result.type,
    result_name: result.name,
  });
  if (copied) {
    alert('分享文案已复制');
  } else {
    track('copy_failed', {
      page_id: 'result',
      target: 'share_text',
    });
    window.prompt('复制失败，请长按复制以下文案', text);
  }
  void flushAnalytics();
}

async function copyText(text) {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.className = 'clipboard-fallback';
    document.body.append(textarea);
    textarea.select();

    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }
}

function downloadResultSvg(result, report) {
  const svg = buildResultSvg(result, report);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${buildArchiveCode(state.answers.length).toLowerCase()}-${sanitizeFilename(result.name)}.svg`;
  link.click();
  URL.revokeObjectURL(url);
  track('save_image_click', {
    page_id: 'result',
    result_type_internal: result.type,
    result_name: result.name,
    image_type: 'svg',
  });
}
