import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const COLLECTION = 'segments';

// POST /api/segments/bulk-update
export async function POST(req: NextRequest) {
    try {
        const db = await getDb();
        const col = db.collection(COLLECTION);

        const updates: Array<{ id: string;[key: string]: any }> = await req.json();

        if (!Array.isArray(updates) || updates.length === 0) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const ops = updates.map(({ id, ...fields }) => ({
            updateOne: {
                filter: { _id: new ObjectId(id) },
                update: {
                    $set: {
                        ...fields,
                        is_labeled: true,
                        updated_at: new Date().toISOString(),
                    },
                },
            },
        }));

        const result = await col.bulkWrite(ops);

        return NextResponse.json({ updated: result.modifiedCount });
    } catch (err: any) {
        console.error('[POST /api/segments/bulk-update]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
