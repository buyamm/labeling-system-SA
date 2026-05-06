import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

const VALID_ASPECTS = new Set([
    'ky_nang_giang_day',
    'kinh_nghiem',
    'hanh_vi',
    'bai_tap',
    'cham_diem',
    'cung_cap_tai_lieu',
    'kien_thuc',
    'chuong_trinh_hoc',
    'thiet_bi_day_hoc',
    'de_xuat',
    'noi_chung',
]);

const VALID_SENTIMENTS = new Set(['negative', 'neutral', 'positive']);

/** Parse a single CSV line, handling quoted fields */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
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

// POST /api/import — parse CSV body and insert into a named collection
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            collection: string;
            csvText: string;
        };

        const { collection: collectionName, csvText } = body;

        if (!collectionName || !csvText) {
            return NextResponse.json(
                { error: 'Thiếu tham số collection hoặc csvText' },
                { status: 400 }
            );
        }

        // Sanitize collection name: only allow alphanumeric, underscore, hyphen
        if (!/^[a-zA-Z0-9_-]+$/.test(collectionName)) {
            return NextResponse.json(
                { error: 'Tên collection không hợp lệ. Chỉ dùng chữ cái, số, _ hoặc -' },
                { status: 400 }
            );
        }

        const lines = csvText.split('\n').filter((l) => l.trim());
        if (lines.length < 2) {
            return NextResponse.json(
                { error: 'File CSV không có dữ liệu' },
                { status: 400 }
            );
        }

        const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

        // Required columns
        const COL = {
            id: header.indexOf('id'),
            text: header.indexOf('text'),
            sentiment: header.indexOf('sentiment'),
            aspect: header.indexOf('aspect'),
        };

        if (COL.text === -1) {
            return NextResponse.json(
                { error: `Không tìm thấy cột "text" trong CSV. Các cột hiện có: ${header.join(', ')}` },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();
        const documents: Record<string, any>[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length < 2) continue;

            const text = COL.text !== -1 ? (cols[COL.text] || '').trim() : '';
            if (!text) continue;

            const rawSentiment = COL.sentiment !== -1
                ? (cols[COL.sentiment] || '').toLowerCase().trim()
                : '';
            const sentiment = VALID_SENTIMENTS.has(rawSentiment) ? rawSentiment : null;

            if (rawSentiment && !sentiment) {
                errors.push(`Dòng ${i + 1}: sentiment "${rawSentiment}" không hợp lệ`);
            }

            const rawAspect = COL.aspect !== -1
                ? (cols[COL.aspect] || '').toLowerCase().trim()
                : '';
            const aspect = VALID_ASPECTS.has(rawAspect) ? rawAspect : null;

            if (rawAspect && !aspect) {
                errors.push(`Dòng ${i + 1}: aspect "${rawAspect}" không hợp lệ`);
            }

            const csvId = COL.id !== -1 ? (cols[COL.id] || '').trim() : '';

            documents.push({
                csv_id: csvId || null,
                text,
                aspect: aspect || null,
                sentiment: sentiment || null,
                confidence: 0,
                entity: null,
                aspect_raw: rawAspect || null,
                user_aspect: null,
                user_sentiment: null,
                note: null,
                is_labeled: false,
                created_at: now,
                updated_at: now,
            });
        }

        if (documents.length === 0) {
            return NextResponse.json(
                { error: 'Không có dòng dữ liệu hợp lệ nào trong CSV' },
                { status: 400 }
            );
        }

        const db = await getDb();
        const col = db.collection(collectionName);
        const result = await col.insertMany(documents);

        return NextResponse.json({
            inserted: result.insertedCount,
            total_rows: lines.length - 1,
            errors: errors.slice(0, 20), // cap at 20 error messages
            collection: collectionName,
        });
    } catch (err: any) {
        console.error('[POST /api/import]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
