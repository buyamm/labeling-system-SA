/**
 * Seed script: fetch Google Sheet CSV → parse → insert into MongoDB Atlas
 *
 * Usage:
 *   node scripts/seed.mjs
 *
 * Requires .env.local with MONGODB_URI and MONGODB_DB set.
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Load .env.local manually (no dotenv dependency needed)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');

let MONGODB_URI = '';
let MONGODB_DB = 'labeling_db';

try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key === 'MONGODB_URI') MONGODB_URI = val;
    if (key === 'MONGODB_DB') MONGODB_DB = val;
  }
} catch {
  console.error('Could not read .env.local — make sure it exists.');
  process.exit(1);
}

if (!MONGODB_URI || MONGODB_URI.includes('<username>')) {
  console.error('❌  Please fill in MONGODB_URI in .env.local before running this script.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fetch CSV from Google Sheets
// ---------------------------------------------------------------------------
const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1iFZT3Bu_FyyndCPuKWrlYev0PzsHObiEYU2B7H13Sco/export?format=csv&gid=0';

console.log('📥  Fetching data from Google Sheets...');
const res = await fetch(SHEET_CSV_URL);
if (!res.ok) {
  console.error('❌  Failed to fetch sheet:', res.status, res.statusText);
  process.exit(1);
}
const csvText = await res.text();

// ---------------------------------------------------------------------------
// Parse CSV (handles quoted fields with commas inside)
// ---------------------------------------------------------------------------
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const lines = csvText.split('\n').filter(l => l.trim());
const header = parseCSVLine(lines[0]);
console.log('📋  Columns:', header.join(', '));

// Expected columns: text, aspect, entity, attribute, aspect_label, sentiment, confidence
const COL = {
  text: header.indexOf('text'),
  aspect: header.indexOf('aspect'),         // e.g. FACILITIES#Classroom
  entity: header.indexOf('entity'),         // e.g. FACILITIES
  attribute: header.indexOf('attribute'),   // e.g. Classroom  ← this is the AspectType
  aspect_label: header.indexOf('aspect_label'),
  sentiment: header.indexOf('sentiment'),
  confidence: header.indexOf('confidence'),
};

const VALID_ASPECTS = new Set([
  'Teaching_Skill', 'Knowledge', 'Experience', 'Behavior', 'Support',
  'Curriculum', 'Materials', 'Workload', 'Assignments', 'Grading',
  'Exams', 'Classroom', 'Platforms', 'General', 'Recommendation',
]);

const VALID_SENTIMENTS = new Set(['negative', 'neutral', 'positive']);

const now = new Date().toISOString();
const documents = [];

for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  if (cols.length < 4) continue;

  const text = cols[COL.text] || '';
  if (!text) continue;

  const rawAspect = cols[COL.attribute] || '';
  const aspect = VALID_ASPECTS.has(rawAspect) ? rawAspect : null;

  const rawSentiment = (cols[COL.sentiment] || '').toLowerCase().trim();
  const sentiment = VALID_SENTIMENTS.has(rawSentiment) ? rawSentiment : null;

  const confidence = parseFloat(cols[COL.confidence]) || 0;

  documents.push({
    text,
    aspect,
    sentiment,
    confidence,
    entity: cols[COL.entity] || null,
    aspect_raw: cols[COL.aspect] || null,   // keep original e.g. FACILITIES#Classroom
    user_aspect: null,
    user_sentiment: null,
    note: null,
    is_labeled: false,
    created_at: now,
    updated_at: now,
  });
}

console.log(`✅  Parsed ${documents.length} records from sheet.`);

// ---------------------------------------------------------------------------
// Insert into MongoDB
// ---------------------------------------------------------------------------
console.log('🔌  Connecting to MongoDB Atlas...');
const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db(MONGODB_DB);
const col = db.collection('segments');

// Drop existing data and re-seed (idempotent)
const existing = await col.countDocuments();
if (existing > 0) {
  console.log(`⚠️   Collection already has ${existing} documents. Dropping and re-seeding...`);
  await col.drop();
}

// Create indexes for common query patterns
await col.createIndex({ is_labeled: 1 });
await col.createIndex({ sentiment: 1 });
await col.createIndex({ aspect: 1 });
await col.createIndex({ user_sentiment: 1 });
await col.createIndex({ user_aspect: 1 });

const result = await col.insertMany(documents);
console.log(`🎉  Inserted ${result.insertedCount} documents into "${MONGODB_DB}.segments"`);

await client.close();
console.log('✅  Done!');
