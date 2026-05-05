import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const COLLECTION = 'segments';
const PAGE_SIZE = 20;

// GET /api/segments
export async function GET(req: NextRequest) {
    try {
        const db = await getDb();
        const col = db.collection(COLLECTION);

        const { searchParams } = req.nextUrl;
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const is_labeled = searchParams.get('is_labeled');
        const sentiment = searchParams.get('sentiment');
        const aspect = searchParams.get('aspect');
        const user_sentiment = searchParams.get('user_sentiment');
        const user_aspect = searchParams.get('user_aspect');

        // Build filter
        const filter: Record<string, any> = {};

        if (is_labeled !== null && is_labeled !== 'All') {
            filter.is_labeled = is_labeled === 'true';
        }
        if (sentiment && sentiment !== 'All') {
            filter.sentiment = sentiment;
        }
        if (aspect && aspect !== 'All') {
            filter.aspect = aspect;
        }
        if (user_sentiment && user_sentiment !== 'All') {
            filter.user_sentiment = user_sentiment;
        }
        if (user_aspect && user_aspect !== 'All') {
            filter.user_aspect = user_aspect;
        }

        const count = await col.countDocuments(filter);
        const total_pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
        const current_page = Math.min(page, total_pages);
        const skip = (current_page - 1) * PAGE_SIZE;

        const docs = await col
            .find(filter)
            .sort({ _id: 1 })
            .skip(skip)
            .limit(PAGE_SIZE)
            .toArray();

        // Serialize _id → id
        const results = docs.map(({ _id, ...rest }) => ({
            id: _id.toString(),
            ...rest,
        }));

        return NextResponse.json({
            count,
            total_pages,
            current_page,
            next: current_page < total_pages ? `/api/segments?page=${current_page + 1}` : null,
            previous: current_page > 1 ? `/api/segments?page=${current_page - 1}` : null,
            results,
        });
    } catch (err: any) {
        console.error('[GET /api/segments]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
