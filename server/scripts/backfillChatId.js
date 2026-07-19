/**
 * backfillChatId.js — one-time migration for the multi-user rollout.
 *
 * Every reminder created before multi-user support has no `chatId`. This script
 * stamps all such documents with a chosen chatId so they belong to a real user
 * (typically the original single-user owner from TELEGRAM_CHAT_ID).
 *
 * Run from the server/ directory:
 *   node scripts/backfillChatId.js                 # uses TELEGRAM_CHAT_ID
 *   node scripts/backfillChatId.js 123456789       # explicit chatId
 *   node scripts/backfillChatId.js --dry-run       # report only, no writes
 *
 * Safe to re-run: it only touches documents where chatId is missing/null/''.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const explicit = args.find((a) => !a.startsWith('--'));
  const chatId = String(explicit || process.env.TELEGRAM_CHAT_ID || '').trim();

  if (!chatId) {
    console.error(
      RED('✖ No chatId provided. Pass one as an argument or set TELEGRAM_CHAT_ID in .env.')
    );
    process.exit(1);
  }

  if (!process.env.MONGO_URI) {
    console.error(RED('✖ MONGO_URI is not set.'));
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(GREEN('✓ Connected to MongoDB'));

  // Match docs with no owner: missing, null, or empty-string chatId.
  const filter = { $or: [{ chatId: { $exists: false } }, { chatId: null }, { chatId: '' }] };
  const count = await Reminder.countDocuments(filter);

  console.log(`Found ${YELLOW(count)} reminder(s) without a chatId.`);

  if (count === 0) {
    console.log(GREEN('Nothing to backfill. ✔'));
  } else if (dryRun) {
    console.log(YELLOW(`[dry-run] Would stamp them all with chatId="${chatId}". No writes made.`));
  } else {
    // updateMany bypasses the pre-validate hook, which is fine — we set chatId explicitly.
    const res = await Reminder.updateMany(filter, { $set: { chatId } });
    console.log(GREEN(`✓ Updated ${res.modifiedCount} document(s) → chatId="${chatId}"`));
  }

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(RED('✖ Backfill failed:'), err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
