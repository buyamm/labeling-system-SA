"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Loader2, AlertTriangle, CheckCircle2, RefreshCw,
  Database, ChevronLeft, ChevronRight, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { collectionApi } from "@/features/labeling/api/segmentApi";
import { CollectionInfo, CollectionSummary, MismatchRow, StatsResponse } from "@/features/labeling/types";

const ALL = "__all__";

const ASPECT_LABEL: Record<string, string> = {
  ky_nang_giang_day: "Kỹ năng giảng dạy",
  kinh_nghiem: "Kinh nghiệm",
  hanh_vi: "Hành vi",
  bai_tap: "Bài tập",
  cham_diem: "Chấm điểm",
  cung_cap_tai_lieu: "Cung cấp tài liệu",
  kien_thuc: "Kiến thức",
  chuong_trinh_hoc: "Chương trình học",
  thiet_bi_day_hoc: "Thiết bị dạy học",
  de_xuat: "Đề xuất",
  noi_chung: "Nói chung",
  null: "(Chưa có nhãn)",
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "Tích cực",
  neutral: "Trung lập",
  negative: "Tiêu cực",
  null: "(Chưa có nhãn)",
};

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "#22c55e",
  neutral: "#eab308",
  negative: "#ef4444",
  null: "#94a3b8",
};

const ASPECT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6",
  "#06b6d4", "#84cc16", "#f59e0b", "#6366f1", "#10b981", "#64748b",
];

function pct(n: number, total: number) {
  if (!total) return "0";
  return ((n / total) * 100).toFixed(1);
}

// Donut chart (SVG)
interface DonutSlice { label: string; value: number; color: string }
function DonutChart({ slices, size = 160, title }: { slices: DonutSlice[]; size?: number; title: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) return <div className="flex h-40 items-center justify-center text-sm text-slate-400">Không có dữ liệu</div>;
  const r = 56; const cx = size / 2; const cy = size / 2;
  let angle = -Math.PI / 2;
  const paths: { d: string; color: string; label: string; value: number }[] = [];
  for (const s of slices) {
    if (!s.value) continue;
    const sweep = (s.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle); const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle); const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    paths.push({ d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`, color: s.color, label: s.label, value: s.value });
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
      <div className="relative">
        <svg width={size} height={size}>
          {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} stroke="white" strokeWidth={2} />)}
          <circle cx={cx} cy={cy} r={r * 0.55} fill="white" />
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={20} fontWeight="bold" fill="#1e293b">{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill="#64748b">tổng</text>
        </svg>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {slices.filter(s => s.value > 0).map((s, i) => (
          <div key={i} className="flex items-center gap-1 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span className="font-bold text-slate-800">{s.value}</span>
            <span className="text-slate-400">({pct(s.value, total)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal bar chart
interface BarItem { label: string; value: number; color?: string }
function HBarChart({ items, title }: { items: BarItem[]; title: string }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
      {items.length === 0 && <p className="text-sm text-slate-400 italic">Không có dữ liệu</p>}
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-36 shrink-0 truncate text-right text-xs text-slate-600" title={item.label}>{item.label}</span>
          <div className="flex-1 rounded-full bg-slate-100 h-5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
              style={{ width: `${(item.value / max) * 100}%`, background: item.color ?? "#3b82f6", minWidth: item.value ? 28 : 0 }}>
              <span className="text-[10px] font-bold text-white">{item.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Confusion table
function ConfusionTable({ data, labelMap, title }: { data: Record<string, number>; labelMap: Record<string, string>; title: string }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 15);
  if (!entries.length) return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="text-sm text-slate-400 italic">Không có sự khác biệt nào</p>
    </div>
  );
  const maxVal = entries[0][1];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2 text-left font-bold text-slate-600">AI dự đoán</th>
              <th className="px-3 py-2 text-left font-bold text-slate-600">Người dùng sửa thành</th>
              <th className="px-3 py-2 text-right font-bold text-slate-600">Số lần</th>
              <th className="px-3 py-2 text-left font-bold text-slate-600 w-28">Tỉ lệ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map(([key, count], i) => {
              const [ai, user] = key.split(" \u2192 ");
              return (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 font-medium text-slate-700">{labelMap[ai] ?? ai}</td>
                  <td className="px-3 py-2 text-blue-700 font-semibold">{labelMap[user] ?? user}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900">{count}</td>
                  <td className="px-3 py-2">
                    <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${(count / maxVal) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Stat card
function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className={cn("text-3xl font-bold", color ?? "text-slate-900")}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

// Sentiment pill
function SentimentPill({ value, mismatch }: { value: string | null; mismatch?: boolean }) {
  const label = SENTIMENT_LABEL[value ?? "null"] ?? value ?? "\u2014";
  const color = SENTIMENT_COLOR[value ?? "null"] ?? "#94a3b8";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white", mismatch && "ring-2 ring-amber-400 ring-offset-1")} style={{ background: color }}>
      {mismatch && <AlertTriangle className="h-3 w-3" />}{label}
    </span>
  );
}

// Aspect pill
function AspectPill({ value, mismatch }: { value: string | null; mismatch?: boolean }) {
  const label = ASPECT_LABEL[value ?? "null"] ?? value ?? "\u2014";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-100", mismatch && "ring-2 ring-amber-400 ring-offset-1 bg-amber-50 text-amber-800 border-amber-200")}>
      {mismatch && <AlertTriangle className="h-3 w-3" />}{label}
    </span>
  );
}

// Per-collection comparison table (shown only in __all__ mode)
function PerCollectionTable({ data }: { data: CollectionSummary[] }) {
  if (!data.length) return null;
  const maxLabeled = Math.max(...data.map(d => d.total_labeled), 1);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">So sánh từng collection</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
              <th className="px-4 py-3 text-left">Collection</th>
              <th className="px-4 py-3 text-right">Đã gán nhãn</th>
              <th className="px-4 py-3 text-right">Sentiment khớp</th>
              <th className="px-4 py-3 text-right">Sentiment khác</th>
              <th className="px-4 py-3 text-right">Aspect khớp</th>
              <th className="px-4 py-3 text-right">Aspect khác</th>
              <th className="px-4 py-3 text-right">Khớp hoàn toàn</th>
              <th className="px-4 py-3 text-center w-40">Tỉ lệ đồng thuận</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => {
              const rate = row.agreement_rate;
              const rateColor = rate >= 80 ? "text-green-600" : rate >= 60 ? "text-yellow-600" : "text-red-600";
              const barColor = rate >= 80 ? "#22c55e" : rate >= 60 ? "#eab308" : "#ef4444";
              return (
                <tr key={row.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span className="font-semibold text-slate-800">{row.name}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: `${(row.total_labeled / maxLabeled) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{row.total_labeled.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-green-700">{row.sentiment_match}</span>
                    <span className="ml-1 text-[10px] text-slate-400">({pct(row.sentiment_match, row.total_labeled)}%)</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-red-600">{row.sentiment_mismatch}</span>
                    <span className="ml-1 text-[10px] text-slate-400">({pct(row.sentiment_mismatch, row.total_labeled)}%)</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-blue-700">{row.aspect_match}</span>
                    <span className="ml-1 text-[10px] text-slate-400">({pct(row.aspect_match, row.total_labeled)}%)</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-orange-600">{row.aspect_mismatch}</span>
                    <span className="ml-1 text-[10px] text-slate-400">({pct(row.aspect_mismatch, row.total_labeled)}%)</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-green-700">{row.both_match}</span>
                    <span className="ml-1 text-[10px] text-slate-400">({pct(row.both_match, row.total_labeled)}%)</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn("text-sm font-bold", rateColor)}>{rate}%</span>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, background: barColor }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-800">
              <td className="px-4 py-3 text-xs uppercase tracking-wider">Tổng cộng</td>
              <td className="px-4 py-3 text-right">{data.reduce((s, r) => s + r.total_labeled, 0).toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-green-700">{data.reduce((s, r) => s + r.sentiment_match, 0)}</td>
              <td className="px-4 py-3 text-right text-red-600">{data.reduce((s, r) => s + r.sentiment_mismatch, 0)}</td>
              <td className="px-4 py-3 text-right text-blue-700">{data.reduce((s, r) => s + r.aspect_match, 0)}</td>
              <td className="px-4 py-3 text-right text-orange-600">{data.reduce((s, r) => s + r.aspect_mismatch, 0)}</td>
              <td className="px-4 py-3 text-right text-green-700">{data.reduce((s, r) => s + r.both_match, 0)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Grouped bar chart: per-collection agreement rates
function AgreementBarChart({ data }: { data: CollectionSummary[] }) {
  if (!data.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tỉ lệ đồng thuận theo collection (%)</p>
      <div className="flex flex-col gap-2">
        {data.map((row) => {
          const rate = row.agreement_rate;
          const barColor = rate >= 80 ? "#22c55e" : rate >= 60 ? "#eab308" : "#ef4444";
          return (
            <div key={row.name} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-right text-xs font-semibold text-slate-700" title={row.name}>{row.name}</span>
              <div className="flex-1 rounded-full bg-slate-100 h-6 overflow-hidden relative">
                <div className="h-full rounded-full transition-all duration-500 flex items-center px-2"
                  style={{ width: `${rate}%`, background: barColor, minWidth: rate > 0 ? 40 : 0 }}>
                  <span className="text-[11px] font-bold text-white">{rate}%</span>
                </div>
              </div>
              <span className="w-16 shrink-0 text-xs text-slate-500">{row.total_labeled.toLocaleString()} câu</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Mismatch table
function MismatchTable({
  rows, page, totalPages, total, onPage, showCollection,
}: {
  rows: MismatchRow[]; page: number; totalPages: number; total: number;
  onPage: (p: number) => void; showCollection: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Danh sách câu có sự khác biệt ({total} câu)
        </p>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 disabled:opacity-40 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-xs">Trang {page}/{totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 disabled:opacity-40 transition-colors"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-500 mb-2" />
          <p className="font-semibold text-green-700">Tuyệt vời! AI và người dùng đồng ý hoàn toàn.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-3 text-left w-8">#</th>
                {showCollection && <th className="px-4 py-3 text-left w-32">Collection</th>}
                <th className="px-4 py-3 text-left">Nội dung</th>
                <th className="px-4 py-3 text-center w-32">Cảm xúc AI</th>
                <th className="px-4 py-3 text-center w-32">Cảm xúc ND</th>
                <th className="px-4 py-3 text-center w-40">Khía cạnh AI</th>
                <th className="px-4 py-3 text-center w-40">Khía cạnh ND</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={row.id + row.collection} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{(page - 1) * 50 + i + 1}</td>
                  {showCollection && (
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100">{row.collection}</span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-800 max-w-xs">
                    <p className="line-clamp-2 text-sm leading-relaxed">{row.text}</p>
                  </td>
                  <td className="px-4 py-3 text-center"><SentimentPill value={row.ai_sentiment} /></td>
                  <td className="px-4 py-3 text-center"><SentimentPill value={row.user_sentiment} mismatch={!row.sentiment_match} /></td>
                  <td className="px-4 py-3 text-center"><AspectPill value={row.ai_aspect} /></td>
                  <td className="px-4 py-3 text-center"><AspectPill value={row.user_aspect} mismatch={!row.aspect_match} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Main component
type FullStats = StatsResponse & { mismatch_total: number; mismatch_page: number; mismatch_total_pages: number };

export function Statistics() {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("segments");
  const [stats, setStats] = useState<FullStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mismatchPage, setMismatchPage] = useState(1);

  useEffect(() => {
    collectionApi.getCollections()
      .then(cols => {
        setCollections(cols);
        if (cols.length > 0 && !cols.find(c => c.name === "segments")) {
          setSelectedCollection(cols[0].name);
        }
      })
      .catch(console.error);
  }, []);

  const loadStats = useCallback(async (collection: string, page: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await collectionApi.getStats(collection, page, 50);
      setStats(data);
    } catch (err: any) {
      setError(err.message ?? "Lỗi khi tải thống kê");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats(selectedCollection, mismatchPage);
  }, [selectedCollection, mismatchPage, loadStats]);

  const handleCollectionChange = (name: string) => {
    setSelectedCollection(name);
    setMismatchPage(1);
  };

  const isAll = selectedCollection === ALL;

  const sentimentDonut = stats ? [
    { label: "Khop", value: stats.sentiment_match, color: "#22c55e" },
    { label: "Khac", value: stats.sentiment_mismatch, color: "#ef4444" },
  ] : [];

  const aspectDonut = stats ? [
    { label: "Khop", value: stats.aspect_match, color: "#3b82f6" },
    { label: "Khac", value: stats.aspect_mismatch, color: "#f97316" },
  ] : [];

  const aspectMismatchBars = stats
    ? Object.entries(stats.aspect_mismatch_breakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v], i) => ({ label: ASPECT_LABEL[k] ?? k, value: v, color: ASPECT_COLORS[i % ASPECT_COLORS.length] }))
    : [];

  const sentimentMismatchBars = stats
    ? Object.entries(stats.sentiment_mismatch_breakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => ({ label: SENTIMENT_LABEL[k] ?? k, value: v, color: SENTIMENT_COLOR[k] ?? "#94a3b8" }))
    : [];

  const agreementRate = stats && stats.total_labeled
    ? ((stats.both_match / stats.total_labeled) * 100).toFixed(1)
    : "\u2014";

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 text-slate-800 font-sans">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 uppercase">Thống kê</h1>
            <p className="mt-1 text-sm text-slate-500">So sánh kết quả AI và người dùng xác nhận (chỉ tính câu đã gán nhãn)</p>
          </div>
          <button onClick={() => loadStats(selectedCollection, mismatchPage)} disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Làm mới
          </button>
        </div>

        {/* Collection selector */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <Database className="h-5 w-5 shrink-0 text-blue-600" />
          <span className="text-sm font-semibold text-slate-700 shrink-0">Collection:</span>

          {/* "Tất cả" button */}
          <button
            onClick={() => handleCollectionChange(ALL)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all",
              selectedCollection === ALL
                ? "border-purple-500 bg-purple-600 text-white shadow-sm"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Tất cả
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              selectedCollection === ALL ? "bg-purple-500 text-white" : "bg-slate-200 text-slate-600")}>
              {collections.reduce((s, c) => s + c.count, 0).toLocaleString()}
            </span>
          </button>

          <div className="h-5 w-px bg-slate-200" />

          {collections.map(col => (
            <button key={col.name} onClick={() => handleCollectionChange(col.name)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all",
                selectedCollection === col.name
                  ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
              )}>
              {col.name}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                selectedCollection === col.name ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-600")}>
                {col.count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        {loading && !stats && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          </div>
        )}

        {stats && (
          <div className={cn("flex flex-col gap-8 transition-opacity", loading && "opacity-50 pointer-events-none")}>

            {/* Banner khi ở chế độ tất cả */}
            {isAll && (
              <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-5 py-3">
                <Layers className="h-5 w-5 text-purple-600 shrink-0" />
                <p className="text-sm font-semibold text-purple-800">
                  Đang hiển thị thống kê tổng hợp từ <span className="font-bold">{stats.per_collection?.length ?? 0} collections</span>.
                  Cuộn xuống để xem bảng so sánh chi tiết từng collection.
                </p>
              </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Tổng đã gán nhãn" value={stats.total_labeled.toLocaleString()} color="text-slate-900" />
              <StatCard
                label="Tỉ lệ đồng thuận"
                value={`${agreementRate}%`}
                sub="Cả sentiment & aspect đều khớp"
                color={parseFloat(agreementRate) >= 80 ? "text-green-600" : parseFloat(agreementRate) >= 60 ? "text-yellow-600" : "text-red-600"}
              />
              <StatCard label="Câu có sự khác biệt" value={stats.either_mismatch.toLocaleString()} sub={`${pct(stats.either_mismatch, stats.total_labeled)}% tổng số`} color="text-amber-600" />
              <StatCard label="Khớp hoàn toàn" value={stats.both_match.toLocaleString()} sub={`${pct(stats.both_match, stats.total_labeled)}% tổng số`} color="text-green-600" />
            </div>

            {/* Per-collection agreement bar chart (only in __all__ mode) */}
            {isAll && stats.per_collection && stats.per_collection.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <AgreementBarChart data={stats.per_collection} />
              </div>
            )}

            {/* Donut charts */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <DonutChart title="Cảm xúc (Sentiment) — Khớp vs Khác" slices={sentimentDonut} />
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <div className="text-xl font-bold text-green-700">{stats.sentiment_match}</div>
                    <div className="text-[11px] text-green-600">Khớp ({pct(stats.sentiment_match, stats.total_labeled)}%)</div>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 text-center">
                    <div className="text-xl font-bold text-red-700">{stats.sentiment_mismatch}</div>
                    <div className="text-[11px] text-red-600">Khác ({pct(stats.sentiment_mismatch, stats.total_labeled)}%)</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <DonutChart title="Khía cạnh (Aspect) — Khớp vs Khác" slices={aspectDonut} />
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <div className="text-xl font-bold text-blue-700">{stats.aspect_match}</div>
                    <div className="text-[11px] text-blue-600">Khớp ({pct(stats.aspect_match, stats.total_labeled)}%)</div>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3 text-center">
                    <div className="text-xl font-bold text-orange-700">{stats.aspect_mismatch}</div>
                    <div className="text-[11px] text-orange-600">Khác ({pct(stats.aspect_mismatch, stats.total_labeled)}%)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bar charts */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <HBarChart title="Khía cạnh bị sửa nhiều nhất (AI → Người dùng)" items={aspectMismatchBars} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <HBarChart title="Cảm xúc bị sửa nhiều nhất (AI → Người dùng)" items={sentimentMismatchBars} />
              </div>
            </div>

            {/* Confusion tables */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <ConfusionTable title="Chi tiết sửa đổi Cảm xúc" data={stats.sentiment_confusion} labelMap={SENTIMENT_LABEL} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <ConfusionTable title="Chi tiết sửa đổi Khía cạnh" data={stats.aspect_confusion} labelMap={ASPECT_LABEL} />
              </div>
            </div>

            {/* Per-collection detail table (only in __all__ mode) */}
            {isAll && stats.per_collection && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <PerCollectionTable data={stats.per_collection} />
              </div>
            )}

            {/* Mismatch rows table */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <MismatchTable
                rows={stats.mismatches}
                page={mismatchPage}
                totalPages={stats.mismatch_total_pages}
                total={stats.mismatch_total}
                onPage={(p) => setMismatchPage(p)}
                showCollection={isAll}
              />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
