export function markChapterCompleteTracked(state, chapterId) {
  const normalizedChapterId = normalizeChapterId(chapterId);
  const trackedChapterCompletes = normalizeChapterIds(state?.trackedChapterCompletes);

  if (!normalizedChapterId || trackedChapterCompletes.includes(normalizedChapterId)) {
    return {
      state: {
        ...state,
        trackedChapterCompletes,
      },
      shouldTrack: false,
    };
  }

  return {
    state: {
      ...state,
      trackedChapterCompletes: [...trackedChapterCompletes, normalizedChapterId],
    },
    shouldTrack: true,
  };
}

export function markTestCompleteTracked(state) {
  if (state?.testCompleteTracked === true) {
    return {
      state: {
        ...state,
        testCompleteTracked: true,
      },
      shouldTrack: false,
    };
  }

  return {
    state: {
      ...state,
      testCompleteTracked: true,
    },
    shouldTrack: true,
  };
}

function normalizeChapterIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeChapterId).filter(Boolean))];
}

function normalizeChapterId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}
