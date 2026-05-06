"use client";
import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2, X, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collectionApi } from '../api/segmentApi';

const VALID_ASPECTS = [
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
];

const VALID_SENTIMENTS = ['positive', 'neutral', 'negative'];

interface ImportResult {
    inserted: number;
    total_rows: number;
    errors: string[];
    collection: string;
}

interface PreviewRow {
    id: string;
    text: string;
    sentiment: string;
    aspect: string;
    sentimentValid: boolean;
    aspectValid: boolean;
}

export const CSVImport = () => {
    const [collectionName, setCollectionName] = useState('');
    const [csvText, setCsvText] = useState('');
    const [fileName, setFileName] = useState('');
    const [preview, setPreview] = useState<PreviewRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parsePreview = useCallback((text: string) => {
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length < 2) return;

        const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                    else inQuotes = !inQuotes;
                } else if (ch === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += ch;
                }
            }
            result.push(current.trim());
            return result;
        };

        const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
        const idIdx = header.indexOf('id');
        const textIdx = header.indexOf('text');
        const sentimentIdx = header.indexOf('sentiment');
        const aspectIdx = header.indexOf('aspect');

        const rows: PreviewRow[] = [];
        for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
            const cols = parseCSVLine(lines[i]);
            const sentiment = sentimentIdx !== -1 ? (cols[sentimentIdx] || '').toLowerCase().trim() : '';
            const aspect = aspectIdx !== -1 ? (cols[aspectIdx] || '').toLowerCase().trim() : '';
            rows.push({
                id: idIdx !== -1 ? (cols[idIdx] || '') : '',
                text: textIdx !== -1 ? (cols[textIdx] || '') : '',
                sentiment,
                aspect,
                sentimentValid: !sentiment || VALID_SENTIMENTS.includes(sentiment),
                aspectValid: !aspect || VALID_ASPECTS.includes(aspect),
            });
        }
        setPreview(rows);
    }, []);

    const handleFile = useCallback((file: File) => {
        if (!file.name.endsWith('.csv')) {
            setError('Chỉ chấp nhận file .csv');
            return;
        }
        setFileName(file.name);
        setError('');
        setResult(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            setCsvText(text);
            parsePreview(text);
        };
        reader.readAsText(file, 'UTF-8');
    }, [parsePreview]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleImport = async () => {
        if (!csvText) { setError('Vui lòng chọn file CSV'); return; }
        if (!collectionName.trim()) { setError('Vui lòng nhập tên collection'); return; }
        if (!/^[a-zA-Z0-9_-]+$/.test(collectionName.trim())) {
            setError('Tên collection chỉ được dùng chữ cái, số, _ hoặc -');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);
        try {
            const res = await collectionApi.importCSV(collectionName.trim(), csvText);
            setResult(res);
        } catch (err: any) {
            setError(err.message || 'Lỗi khi import');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setCsvText('');
        setFileName('');
        setPreview([]);
        setResult(null);
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 lg:p-8 text-slate-800 font-sans">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 uppercase">Import CSV</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Upload file CSV để tạo collection mới trong MongoDB. Định dạng: <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">id, text, sentiment, aspect</code>
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Left: Upload + Config */}
                    <div className="flex flex-col gap-4">
                        {/* Collection name */}
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                Tên Collection (MongoDB)
                            </label>
                            <div className="flex items-center gap-2">
                                <Database className="h-4 w-4 shrink-0 text-slate-400" />
                                <input
                                    type="text"
                                    value={collectionName}
                                    onChange={(e) => setCollectionName(e.target.value)}
                                    placeholder="vd: segments_2024, dataset_v2"
                                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <p className="mt-1.5 text-[11px] text-slate-400">
                                Chỉ dùng chữ cái, số, dấu _ hoặc -. Nếu collection đã tồn tại, dữ liệu sẽ được thêm vào.
                            </p>
                        </div>

                        {/* Drop zone */}
                        <div
                            className={cn(
                                "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer",
                                isDragging
                                    ? "border-blue-400 bg-blue-50"
                                    : csvText
                                        ? "border-green-300 bg-green-50"
                                        : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
                            )}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                            />
                            {csvText ? (
                                <>
                                    <FileText className="h-10 w-10 text-green-500 mb-3" />
                                    <p className="text-sm font-semibold text-green-700">{fileName}</p>
                                    <p className="mt-1 text-xs text-green-600">
                                        {csvText.split('\n').filter(l => l.trim()).length - 1} dòng dữ liệu
                                    </p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleReset(); }}
                                        className="mt-3 flex items-center gap-1 rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-100 transition-colors"
                                    >
                                        <X className="h-3.5 w-3.5" /> Xóa file
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Upload className="h-10 w-10 text-slate-300 mb-3" />
                                    <p className="text-sm font-semibold text-slate-600">Kéo thả file CSV vào đây</p>
                                    <p className="mt-1 text-xs text-slate-400">hoặc click để chọn file</p>
                                </>
                            )}
                        </div>

                        {/* Import button */}
                        <button
                            onClick={handleImport}
                            disabled={loading || !csvText || !collectionName.trim()}
                            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Đang import...</>
                            ) : (
                                <><Upload className="h-4 w-4" /> Import vào MongoDB</>
                            )}
                        </button>

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Success result */}
                        {result && (
                            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    <span className="font-bold text-green-800">Import thành công!</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                                        <div className="text-2xl font-bold text-green-600">{result.inserted}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">Đã insert</div>
                                    </div>
                                    <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                                        <div className="text-2xl font-bold text-slate-700">{result.total_rows}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">Tổng dòng CSV</div>
                                    </div>
                                </div>
                                <p className="mt-2 text-xs text-green-700">
                                    Collection: <code className="font-mono font-bold">{result.collection}</code>
                                </p>
                                {result.errors.length > 0 && (
                                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                        <p className="text-xs font-bold text-amber-700 mb-1">
                                            {result.errors.length} cảnh báo (dữ liệu vẫn được import với giá trị null):
                                        </p>
                                        <ul className="space-y-0.5">
                                            {result.errors.map((e, i) => (
                                                <li key={i} className="text-xs text-amber-600">• {e}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Format guide + Preview */}
                    <div className="flex flex-col gap-4">
                        {/* Format guide */}
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Định dạng CSV</h3>
                            <div className="overflow-x-auto rounded-lg border border-slate-100 bg-slate-50">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-100">
                                            <th className="px-3 py-2 text-left font-bold text-slate-600">Cột</th>
                                            <th className="px-3 py-2 text-left font-bold text-slate-600">Bắt buộc</th>
                                            <th className="px-3 py-2 text-left font-bold text-slate-600">Giá trị</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr><td className="px-3 py-2 font-mono font-bold text-blue-600">id</td><td className="px-3 py-2 text-slate-500">Không</td><td className="px-3 py-2 text-slate-600">Bất kỳ</td></tr>
                                        <tr><td className="px-3 py-2 font-mono font-bold text-blue-600">text</td><td className="px-3 py-2 text-green-600 font-semibold">Có</td><td className="px-3 py-2 text-slate-600">Nội dung văn bản</td></tr>
                                        <tr><td className="px-3 py-2 font-mono font-bold text-blue-600">sentiment</td><td className="px-3 py-2 text-slate-500">Không</td><td className="px-3 py-2 font-mono text-slate-600">positive / neutral / negative</td></tr>
                                        <tr><td className="px-3 py-2 font-mono font-bold text-blue-600">aspect</td><td className="px-3 py-2 text-slate-500">Không</td><td className="px-3 py-2 text-slate-600">Xem danh sách bên dưới</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-4">
                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">11 Aspect hợp lệ</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {VALID_ASPECTS.map((a) => (
                                        <span key={a} className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[10px] text-blue-700 border border-blue-100">
                                            {a}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4">
                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">3 Sentiment hợp lệ</p>
                                <div className="flex gap-1.5">
                                    {[
                                        { v: 'positive', cls: 'bg-green-50 text-green-700 border-green-100' },
                                        { v: 'neutral', cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
                                        { v: 'negative', cls: 'bg-red-50 text-red-700 border-red-100' },
                                    ].map(({ v, cls }) => (
                                        <span key={v} className={`rounded-full px-2 py-0.5 font-mono text-[10px] border ${cls}`}>{v}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        {preview.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Xem trước (5 dòng đầu)
                                </h3>
                                <div className="space-y-2">
                                    {preview.map((row, i) => (
                                        <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                                            <p className="font-medium text-slate-800 line-clamp-2">{row.text || <span className="text-red-400 italic">Trống</span>}</p>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                {row.id && (
                                                    <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-600">id: {row.id}</span>
                                                )}
                                                <span className={cn(
                                                    "rounded px-1.5 py-0.5 font-mono",
                                                    row.sentimentValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                )}>
                                                    {row.sentiment || 'sentiment: —'}
                                                    {!row.sentimentValid && ' ⚠'}
                                                </span>
                                                <span className={cn(
                                                    "rounded px-1.5 py-0.5 font-mono",
                                                    row.aspectValid ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                                                )}>
                                                    {row.aspect || 'aspect: —'}
                                                    {!row.aspectValid && ' ⚠'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
