import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const DEFAULT_COLLECTION = 'segments';

// PATCH /api/segments/:id?collection=<name>
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const collectionName = req.nextUrl.searchParams.get('collection') || DEFAULT_COLLECTION;

        const db = await getDb();
        const col = db.collection(collectionName);
        const body = await req.json();

        // Remove id from body if present
        const { id: _ignore, ...updates } = body;

        const result = await col.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: { ...updates, updated_at: new Date().toISOString() } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const { _id, ...rest } = result;
        return NextResponse.json({ id: _id.toString(), ...rest });
    } catch (err: any) {
        console.error('[PATCH /api/segments/:id]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/segments/:id?collection=<name>
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const collectionName = req.nextUrl.searchParams.get('collection') || DEFAULT_COLLECTION;

        const db = await getDb();
        const col = db.collection(collectionName);

        const result = await col.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[DELETE /api/segments/:id]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
