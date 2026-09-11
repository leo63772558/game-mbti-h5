const DEFAULT_CHANNEL = 'default_channel';
const CHANNEL_PATTERN = /^[a-z0-9_-]{1,48}$/;

export function normalizeChannel(channel) {
  const value = String(channel ?? '').trim();
  return CHANNEL_PATTERN.test(value) ? value : DEFAULT_CHANNEL;
}

export function getChannelFromSearch(search = '') {
  const channel = new URLSearchParams(search).get('h5_channel');
  return normalizeChannel(channel);
}

export function mergeStateWithChannel(restoredState, search = '') {
  const searchParams = new URLSearchParams(search);
  const hasUrlChannel = searchParams.has('h5_channel');
  const urlChannel = getChannelFromSearch(search);
  if (!restoredState) {
    return {
      view: 'home',
      currentIndex: 0,
      answers: [],
      channel: urlChannel,
    };
  }

  return {
    ...restoredState,
    channel: hasUrlChannel ? urlChannel : normalizeChannel(restoredState.channel),
  };
}
