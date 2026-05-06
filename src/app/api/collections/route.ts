import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

// GET /api/collections — list all segment collections with document counts
export async function GET() {
    try {
        const db = await getDb();
        const allCollections = await db.listCollections().toArray();

        // Filter to only segment-like collections (exclude system collections)
        const segmentCollections = allCollections.filter(
            (c) => !c.name.startsWith('system.')
        );

        const results = await Promise.all(
            segmentCollections.map(async (c) => {
                const count = await db.collection(c.name).countDocuments();
                return { name: c.name, count };
            })
        );

        // Sort: 'segments' first, then alphabetically
        results.sort((a, b) => {
            if (a.name === 'segments') return -1;
            if (b.name === 'segments') return 1;
            return a.name.localeCompare(b.name);
        });

        return NextResponse.json(results);
    } catch (err: any) {
        console.error('[GET /api/collections]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
