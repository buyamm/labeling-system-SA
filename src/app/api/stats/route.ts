import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

const DEFAULT_COLLECTION = 'segments';
const ALL_COLLECTIONS = '__all__';

export interface MismatchRow {
    id: string;
    text: string;
    collection: string;
    ai_sentiment: string | null;
    user_sentiment: string | null;
    ai_aspect: string | null;
    user_aspect: string | null;
    sentiment_match: boolean;
    aspect_match: boolean;
    updated_at: string;
}

export interface CollectionSummary {
    name: string;
    total_labeled: number;
    sentiment_match: number;
    sentiment_mismatch: number;
    aspect_match: number;
    aspect_mismatch: number;
    both_match: number;
    either_mismatch: number;
    agreement_rate: number; // 0-100
}

export interface StatsResponse {
    collection: string;
    total_labeled: number;
    sentiment_match: number;
    sentiment_mismatch: number;
    aspect_match: number;
    aspect_mismatch: number;
    both_match: number;
    either_mismatch: number;
    sentiment_confusion: Record<string, number>;
    aspect_confusion: Record<string, number>;
    aspect_mismatch_breakdown: Record<string, number>;
    sentiment_mismatch_breakdown: Record<string, number>;
    mismatches: MismatchRow[];
    /** Only present when collection === '__all__' */
    per_collection?: CollectionSummary[];
}

// ─── Core aggregation for a single collection ────────────────────────────────
async function aggregateCollection(collectionName: string) {
    const db = await getDb();
    const col = db.collection(collectionName);

    const filter = { is_labeled: true };
    const allDocs = await col
        .find(filter, {
            projection: { _id: 1, text: 1, sentiment: 1, aspect: 1, user_sentiment: 1, user_aspect: 1, updated_at: 1 },
        })
        .toArray();

    let sentiment_match = 0, sentiment_mismatch = 0;
    let aspect_match = 0, aspect_mismatch = 0;
    let both_match = 0, either_mismatch = 0;

    const sentiment_confusion: Record<string, number> = {};
    const aspect_confusion: Record<string, number> = {};
    const aspect_mismatch_breakdown: Record<string, number> = {};
    const sentiment_mismatch_breakdown: Record<string, number> = {};
    const mismatch_docs: MismatchRow[] = [];

    for (const doc of allDocs) {
        const ai_s = doc.sentiment ?? null;
        const user_s = doc.user_sentiment ?? null;
        const ai_a = doc.aspect ?? null;
        const user_a = doc.user_aspect ?? null;

        const s_match = ai_s === user_s;
        const a_match = ai_a === user_a;

        if (s_match) sentiment_match++; else sentiment_mismatch++;
        if (a_match) aspect_match++; else aspect_mismatch++;
        if (s_match && a_match) both_match++;
        if (!s_match || !a_match) either_mismatch++;

        if (!s_match) {
            const key = `${ai_s ?? 'null'} → ${user_s ?? 'null'}`;
            sentiment_confusion[key] = (sentiment_confusion[key] ?? 0) + 1;
            const sk = ai_s ?? 'null';
            sentiment_mismatch_breakdown[sk] = (sentiment_mismatch_breakdown[sk] ?? 0) + 1;
        }
        if (!a_match) {
            const key = `${ai_a ?? 'null'} → ${user_a ?? 'null'}`;
            aspect_confusion[key] = (aspect_confusion[key] ?? 0) + 1;
            const ak = ai_a ?? 'null';
            aspect_mismatch_breakdown[ak] = (aspect_mismatch_breakdown[ak] ?? 0) + 1;
        }

        if (!s_match || !a_match) {
            mismatch_docs.push({
                id: doc._id.toString(),
                text: doc.text ?? '',
                collection: collectionName,
                ai_sentiment: ai_s,
                user_sentiment: user_s,
                ai_aspect: ai_a,
                user_aspect: user_a,
                sentiment_match: s_match,
                aspect_match: a_match,
                updated_at: doc.updated_at ?? '',
            });
        }
    }

    const total_labeled = allDocs.length;
    return {
        total_labeled,
        sentiment_match, sentiment_mismatch,
        aspect_match, aspect_mismatch,
        both_match, either_mismatch,
        sentiment_confusion, aspect_confusion,
        aspect_mismatch_breakdown, sentiment_mismatch_breakdown,
        mismatch_docs,
    };
}

// ─── Merge two confusion/breakdown maps ─────────────────────────────────────
function mergeRecord(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
        out[k] = (out[k] ?? 0) + v;
    }
    return out;
}

function sortObj(obj: Record<string, number>): Record<string, number> {
    return Object.fromEntries(Object.entries(obj).sort(([, a], [, b]) => b - a));
}

// GET /api/stats?collection=<name|__all__>&page=<n>&limit=<n>
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const collectionParam = searchParams.get('collection') || DEFAULT_COLLECTION;
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

        const db = await getDb();

        // ── ALL collections mode ─────────────────────────────────────────────
        if (collectionParam === ALL_COLLECTIONS) {
            const allCols = await db.listCollections().toArray();
            const colNames = allCols
                .filter(c => !c.name.startsWith('system.'))
                .map(c => c.name);

            // Aggregate each collection in parallel
            const results = await Promise.all(colNames.map(name => aggregateCollection(name)));

            // Merge totals
            let total_labeled = 0, sentiment_match = 0, sentiment_mismatch = 0;
            let aspect_match = 0, aspect_mismatch = 0, both_match = 0, either_mismatch = 0;
            let sentiment_confusion: Record<string, number> = {};
            let aspect_confusion: Record<string, number> = {};
            let aspect_mismatch_breakdown: Record<string, number> = {};
            let sentiment_mismatch_breakdown: Record<string, number> = {};
            const all_mismatch_docs: MismatchRow[] = [];

            const per_collection: CollectionSummary[] = [];

            for (let i = 0; i < colNames.length; i++) {
                const r = results[i];
                total_labeled += r.total_labeled;
                sentiment_match += r.sentiment_match;
                sentiment_mismatch += r.sentiment_mismatch;
                aspect_match += r.aspect_match;
                aspect_mismatch += r.aspect_mismatch;
                both_match += r.both_match;
                either_mismatch += r.either_mismatch;
                sentiment_confusion = mergeRecord(sentiment_confusion, r.sentiment_confusion);
                aspect_confusion = mergeRecord(aspect_confusion, r.aspect_confusion);
                aspect_mismatch_breakdown = mergeRecord(aspect_mismatch_breakdown, r.aspect_mismatch_breakdown);
                sentiment_mismatch_breakdown = mergeRecord(sentiment_mismatch_breakdown, r.sentiment_mismatch_breakdown);
                all_mismatch_docs.push(...r.mismatch_docs);

                per_collection.push({
                    name: colNames[i],
                    total_labeled: r.total_labeled,
                    sentiment_match: r.sentiment_match,
                    sentiment_mismatch: r.sentiment_mismatch,
                    aspect_match: r.aspect_match,
                    aspect_mismatch: r.aspect_mismatch,
                    both_match: r.both_match,
                    either_mismatch: r.either_mismatch,
                    agreement_rate: r.total_labeled
                        ? parseFloat(((r.both_match / r.total_labeled) * 100).toFixed(1))
                        : 0,
                });
            }

            // Sort per_collection by total_labeled desc
            per_collection.sort((a, b) => b.total_labeled - a.total_labeled);

            const skip = (page - 1) * limit;
            const paginatedMismatches = all_mismatch_docs.slice(skip, skip + limit);

            return NextResponse.json({
                collection: ALL_COLLECTIONS,
                total_labeled,
                sentiment_match, sentiment_mismatch,
                aspect_match, aspect_mismatch,
                both_match, either_mismatch,
                sentiment_confusion: sortObj(sentiment_confusion),
                aspect_confusion: sortObj(aspect_confusion),
                aspect_mismatch_breakdown: sortObj(aspect_mismatch_breakdown),
                sentiment_mismatch_breakdown: sortObj(sentiment_mismatch_breakdown),
                mismatches: paginatedMismatches,
                per_collection,
                mismatch_total: all_mismatch_docs.length,
                mismatch_page: page,
                mismatch_total_pages: Math.max(1, Math.ceil(all_mismatch_docs.length / limit)),
            });
        }

        // ── Single collection mode ───────────────────────────────────────────
        const r = await aggregateCollection(collectionParam);
        const { mismatch_docs, ...rest } = r;

        const skip = (page - 1) * limit;
        const paginatedMismatches = mismatch_docs.slice(skip, skip + limit);

        return NextResponse.json({
            collection: collectionParam,
            ...rest,
            sentiment_confusion: sortObj(rest.sentiment_confusion),
            aspect_confusion: sortObj(rest.aspect_confusion),
            aspect_mismatch_breakdown: sortObj(rest.aspect_mismatch_breakdown),
            sentiment_mismatch_breakdown: sortObj(rest.sentiment_mismatch_breakdown),
            mismatches: paginatedMismatches,
            mismatch_total: mismatch_docs.length,
            mismatch_page: page,
            mismatch_total_pages: Math.max(1, Math.ceil(mismatch_docs.length / limit)),
        });
    } catch (err: any) {
        console.error('[GET /api/stats]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
