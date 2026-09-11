import { normalizeChannel } from './channel.mjs';

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function splitTextLines(text, maxLength = 18) {
  const chars = Array.from(String(text));
  const lines = [];

  for (let index = 0; index < chars.length; index += maxLength) {
    lines.push(chars.slice(index, index + maxLength).join(''));
  }

  return lines;
}

function appendShareHref(copy, href) {
  const text = String(copy ?? '').trim();
  const link = String(href ?? '').trim();
  if (!text) return link;
  if (!link || text.includes(link)) return text;

  return `${text}\n${link}`;
}

export function buildShareText(result, href) {
  if (result?.shareCopy?.generic) {
    return appendShareHref(result.shareCopy.generic, href);
  }

  return `我测出来是【${result.name}】。${result.headline}\n\n你也来测测你的游戏灵魂职业：${href}`;
}

export function buildShareHref(href, channel) {
  try {
    const url = new URL(href);
    const normalizedChannel = normalizeChannel(channel);
    const existingChannel = url.searchParams.get('h5_channel');
    url.hash = '';
    if (existingChannel && normalizeChannel(existingChannel) !== existingChannel) {
      url.searchParams.delete('h5_channel');
    }
    if (!url.searchParams.get('h5_channel') && normalizedChannel !== 'default_channel') {
      url.searchParams.set('h5_channel', normalizedChannel);
    }
    return url.toString();
  } catch {
    return href;
  }
}

export function buildArchiveCode(answerCount = 24) {
  const numericCount = Number.isFinite(Number(answerCount)) && Number(answerCount) > 0 ? Number(answerCount) : 24;
  return `ARCHIVE-${String(Math.round(numericCount)).padStart(3, '0')}`;
}

export function getVersionedAssetSource(source, assetVersion = '') {
  const asset = typeof source === 'string' ? source.trim() : '';
  const version = typeof assetVersion === 'string' ? assetVersion.trim() : '';
  if (!asset || !version || asset.startsWith('data:') || asset.startsWith('blob:')) return asset;

  const hashIndex = asset.indexOf('#');
  const base = hashIndex >= 0 ? asset.slice(0, hashIndex) : asset;
  const hash = hashIndex >= 0 ? asset.slice(hashIndex) : '';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}v=${encodeURIComponent(version)}${hash}`;
}

export function getResultAvatarSource(result, assetVersion = '') {
  if (result?.avatarReady !== true) return '';
  const avatar = typeof result.avatar === 'string' ? result.avatar.trim() : '';
  return getVersionedAssetSource(avatar, assetVersion);
}

export function buildPlatformShareText(result, report, href, platform = 'generic') {
  const customCopy = result?.shareCopy?.[platform] ?? (platform === 'generic' ? result?.shareCopy?.generic : '');
  if (customCopy) {
    return appendShareHref(customCopy, href);
  }

  const identity = result.identity;

  switch (platform) {
    case 'friend_circle':
      return `我被异界档案局判成了【${result.name}】。\n${result.headline}\n\n你也来测测你的游戏灵魂职业：\n${href}`;
    case 'xiaohongshu':
      return `测了一下我的游戏灵魂职业，结果是【${result.name}】。\n一句话精准伤害：${result.headline}\n\n这张异界档案卡有点懂我。想看你会被判成什么职业。\n#游戏人格测试 #游戏搭子 #异界档案卡 #开黑人格 #人格测试\n${href}`;
    case 'bilibili':
      return `发个动态存档：异界档案局给我的职业判定是【${result.name}】。\n${result.headline}\n\n感觉这测试有点懂玩家，来测测你是哪种游戏灵魂职业。\n${href}`;
    case 'xiaoheihe':
      return `我的异界职业档案：【${result.name}】\n档案类型：${identity}\n判词：${result.headline}\n\n你们也测一下，看看谁才是队里真正的问题来源。\n${href}`;
    case 'generic':
    default:
      return buildShareText(result, href);
  }
}

function compactTextBlocks(blocks) {
  return blocks.filter((block) => typeof block === 'string' && block.trim());
}

export function buildResultSvg(result, report, href = '') {
  const tags = result.tags.map((tag) => `#${tag}`).join('  ');
  const archiveCode = buildArchiveCode(report?.answerCount);
  const hiddenTrait = report?.hiddenTrait
    ? `隐藏特质：${report.hiddenTrait.name}｜${report.hiddenTrait.headline}`
    : '';
  const copyBlocks = compactTextBlocks([
    result.headline,
    result.summary,
    hiddenTrait,
    result.charges?.[0],
    `隐藏天赋：${result.talent}`,
    `致命弱点：${result.weakness}`,
  ]);

  const textNodes = copyBlocks
    .flatMap((block) => splitTextLines(block, 21))
    .slice(0, 12)
    .map((line, index) => {
      const y = 690 + index * 64;
      return `<text x="92" y="${y}" fill="#f4efe4" font-size="34" font-family="Arial, sans-serif">${escapeXml(line)}</text>`;
    })
    .join('');
  const nameNodes = splitTextLines(result.name, 12)
    .slice(0, 2)
    .map((line, index) => {
      const y = 505 + index * 62;
      return `<text x="92" y="${y}" fill="#fff" font-size="62" font-weight="700" font-family="Arial, sans-serif">${escapeXml(line)}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1600" viewBox="0 0 1080 1600">
    <rect width="1080" height="1600" fill="#11131f"/>
    <rect x="58" y="58" width="964" height="1484" rx="42" fill="#191d2e" stroke="#c7a96b" stroke-width="4"/>
    <text x="92" y="140" fill="#c7a96b" font-size="34" font-family="Arial, sans-serif">${escapeXml(result.rarity)} · NO. ${escapeXml(archiveCode)}</text>
    <text x="92" y="200" fill="#7be0d6" font-size="34" font-family="Arial, sans-serif">档案类型 · ${escapeXml(result.identity)}</text>
    <circle cx="540" cy="310" r="128" fill="#262d46" stroke="#7be0d6" stroke-width="5"/>
    <text x="540" y="335" text-anchor="middle" fill="#7be0d6" font-size="82" font-weight="700" font-family="Arial, sans-serif">${escapeXml(result.name.slice(0, 2))}</text>
    ${nameNodes}
    <text x="92" y="635" fill="#7be0d6" font-size="34" font-family="Arial, sans-serif">${escapeXml(tags)}</text>
    ${textNodes}
    <text x="92" y="1430" fill="#c7a96b" font-size="34" font-family="Arial, sans-serif">${escapeXml(result.shareCTA)}</text>
    <text x="92" y="1490" fill="#767d99" font-size="28" font-family="Arial, sans-serif">异界开局人格测试 · 异界职业档案</text>
    ${href ? `<text x="92" y="1532" fill="#767d99" font-size="24" font-family="Arial, sans-serif">${escapeXml(href)}</text>` : ''}
  </svg>`;
}
