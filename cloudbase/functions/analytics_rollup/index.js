const cloudbase = require('@cloudbase/node-sdk');
const {
  COLLECTIONS,
  aggregateEvents,
  resolveRollupRange,
} = require('./rollup-core');

const SOURCE_COLLECTION = 'analytics_events';

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});
const db = app.database();

exports.main = async (event = {}) => {
  const startedAt = new Date();

  try {
    const maxDays = parsePositiveInteger(process.env.ROLLUP_MAX_DAYS, 31);
    const pageSize = parsePositiveInteger(process.env.ROLLUP_PAGE_SIZE, 1000);
    const maxSourceEvents = parsePositiveInteger(process.env.ROLLUP_MAX_SOURCE_EVENTS, 50000);
    const range = resolveRollupRange(event, { maxDays });
    const sourceEvents = await fetchSourceEvents(range, { pageSize, maxSourceEvents });
    const recordsByCollection = aggregateEvents(sourceEvents, {
      includeTest: event.includeTest === true,
      updatedAt: startedAt.toISOString(),
    });
    const writeResult = await writeAggregateRecords(recordsByCollection);

    return {
      ok: true,
      range: {
        from: range.from,
        to: range.to,
        timezone: range.timezone,
      },
      scanned_events: sourceEvents.length,
      written_records: writeResult.total,
      records_by_collection: writeResult.byCollection,
      include_test_channels: event.includeTest === true,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('analytics_rollup failed', error);
    return {
      ok: false,
      error: error.code || 'rollup_failed',
      message: error.message,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
    };
  }
};

async function fetchSourceEvents(range, options) {
  const collection = db.collection(SOURCE_COLLECTION);
  const command = db.command;
  if (!command?.gte) throw createError('db_command_unavailable', 'CloudBase database command API is unavailable.');

  const events = [];
  let offset = 0;

  while (true) {
    const result = await collection
      .where({
        at: command.gte(range.startIso).and(command.lt(range.endIso)),
      })
      .orderBy('at', 'asc')
      .skip(offset)
      .limit(options.pageSize)
      .get();
    const page = Array.isArray(result?.data) ? result.data : [];
    events.push(...page);

    if (events.length > options.maxSourceEvents) {
      throw createError('source_event_limit_exceeded', `Rollup scanned more than ${options.maxSourceEvents} events.`);
    }
    if (page.length < options.pageSize) break;
    offset += page.length;
  }

  return events;
}

async function writeAggregateRecords(recordsByCollection) {
  const byCollection = {};
  let total = 0;

  for (const collectionName of Object.values(COLLECTIONS)) {
    const records = recordsByCollection[collectionName] ?? [];
    byCollection[collectionName] = records.length;
    total += records.length;

    const collection = db.collection(collectionName);
    for (const record of records) {
      const { _id, ...data } = record;
      await collection.doc(_id).set(data);
    }
  }

  return { total, byCollection };
}

function parsePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
