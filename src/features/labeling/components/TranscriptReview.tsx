"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Filter, Copy, AlertTriangle, CheckCircle2, Clock, Loader2, Trash2, User, ChevronDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import { AiLabel, SegmentResult } from '../types';
import { segmentApi } from '../api/segmentApi';
import { CustomSelect } from "@/shared/components/CustomSelect";

const MOCK_TYPES = [
   { id: 0, name: 'Báo chí' },
  { id: 1, name: 'Thuần phong mỹ tục ' },
  { id: 2, name: 'Cờ bạc' },
  { id: 3, name: 'Lừa đảo (vay,tín dụng)' },
  { id: 4, name: 'Sàn giao dịch tiền ảo ' },
  { id: 5, name: 'Tổ chức' },
  { id: 7, name: 'Mạng xã hội, diễn đàn' },
  { id: 8, name: 'Game trực tuyến ' },
  { id: 10, name: 'Chính trị' },
  { id: 9, name: 'Khác' },
  
];

const getTypeName = (typeId: number | null) => {
  if (typeId === null) return 'Chưa phân loại';
  const type = MOCK_TYPES.find(t => t.id === typeId);
  return type ? type.name : `Thể loại ${typeId}`;
};

const AiBadge = ({ label }: { label: string | null | undefined }) => {
  const base =
    "inline-flex w-fit items-baseline gap-1.5 rounded px-2 py-1 text-[11px] font-bold tracking-wider uppercase";
  if (label === 'danger') {
    return (
      <div className={`${base} bg-red-700 text-white`}>
        <AlertTriangle className="h-3 w-3 shrink-0 translate-y-[1px]" />
        <span>Vi phạm</span>
      </div>
    );
  }
  if (label === 'safe') {
    return (
      <div className={`${base} bg-green-500 text-white`}>
         <CheckCircle2 className="h-3 w-3 shrink-0 translate-y-[1px]" />
         <span>Không vi phạm</span>
      </div>
    );
  }
  return (
    <div className= {`${base} bg-gray-200 text-gray-600`}>
      <Clock className="h-3 w-3 shrink-0 translate-y-[1px]" />
      <span>{label || "chưa gán nhãn"}</span>
    </div>
  );
};

// User dropdown component
const UserMenu = ({ username, onLogout }: { username: string; onLogout: () => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
          <User className="h-4 w-4" />
        </div>
        <span>{username}</span>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-50">
          <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-400">Đăng nhập với</div>
          <div className="px-4 py-2 text-sm font-semibold text-slate-700">{username}</div>
          <div className="border-t border-slate-100 pt-1">
            <button
              onClick={onLogout}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const TranscriptReview = () => {
  const [data, setData] = useState<SegmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ count: 0, totalPages: 1, currentPage: 1, pageSize: 20 });
  const [pageInput, setPageInput] = useState('1');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Unlabeled' | 'Labeled'>('Unlabeled');
  const [filterLabel, setFilterLabel] = useState<AiLabel | 'All'>('All');
  const [filterType, setFilterType] = useState<number | 'All'>('All');
  const [pendingUpdates, setPendingUpdates] = useState<Record<number, Partial<SegmentResult>>>({});
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [username, setUsername] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUsername(localStorage.getItem('username') || 'User');
    }
  }, []);

  const fetchData = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const isLabeledValue =
        filterStatus === 'Unlabeled' ? 'false' :
        filterStatus === 'Labeled' ? 'true' : 'All';

      const queryParams: any = { page, is_labeled: isLabeledValue };
      
      // Trong tab đã gắn nhãn  theo user_label / user_type thay vì label / type của AI
      if (filterStatus === 'Labeled') {
        queryParams.user_label = filterLabel !== 'All' ? filterLabel : undefined;
        queryParams.user_type = filterType !== 'All' ? filterType : undefined;
      } else {
        queryParams.label = filterLabel !== 'All' ? filterLabel : undefined;
        queryParams.type = filterType !== 'All' ? filterType : undefined;
      }

      const json = await segmentApi.getSegments(queryParams);
      setData(json.results);
      
      const guessedPageSize = (json.current_page < json.total_pages && json.results.length > 0) 
        ? json.results.length 
        : (pagination.pageSize || 20);

      setPagination({ 
        count: json.count, 
        totalPages: json.total_pages, 
        currentPage: json.current_page,
        pageSize: guessedPageSize
      });

      setPageInput(json.current_page.toString());
      setActiveIndex(0);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterLabel, filterType]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleUserUpdate = (id: number, updates: Partial<SegmentResult>) => {
    setData(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    setPendingUpdates(prev => ({ ...prev, [id]: { ...prev[id], ...updates, is_labeled: true } }));
  };

  const handleDelete = (id: number) => {
    if (!window.confirm(`Xóa segment #${id}?`)) return;
    // TODO: gọi segmentApi.deleteSegment(id) khi có endpoint
    setData(prev => prev.filter(item => item.id !== id));
    setPendingUpdates(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  const syncPending = async () => {
    const idsToSync = Object.keys(pendingUpdates).map(Number);
    if (idsToSync.length === 0) return true;

    // Kiểm tra tính hợp lệ: Phải có đủ user_label VÀ user_type mới cho gửi đi
    const invalidSegments = idsToSync.map(id => data.find(d => d.id === id)).filter(Boolean);
    const firstInvalid = invalidSegments.find(seg => !seg!.user_label || seg!.user_type === null || seg!.user_type === undefined);
    
    if (firstInvalid) {
      const idx = data.findIndex(d => d.id === firstInvalid.id);
      if (idx !== -1) setActiveIndex(idx);
      showToast(`Dòng STT #${idx + 1} chưa điền đủ [Nhãn] và [Thể loại]!`, 'error');
      return false; // Ngăn chặn việc lưu và giữ nguyên nút ở pendingUpdates
    }

    setLoading(true);
    try {
      await segmentApi.bulkUpdateSegments(idsToSync.map(id => ({ id, ...pendingUpdates[id] })));
      setPendingUpdates({});
      setLoading(false);
      showToast('Đã lưu tự động');
      return true;
    } catch (error) {
      console.error('Failed to sync:', error);
      const shouldIgnore = window.confirm("Lỗi khi lưu dữ liệu. Bạn có muốn KHÔNG LƯU và tiếp tục không?");
      setLoading(false);
      if (shouldIgnore) { setPendingUpdates({}); return true; }
      return false;
    }
  };

  const handleFilterChange = async (key: 'status' | 'label' | 'type', value: any) => {
    const success = await syncPending();
    if (!success) return;
    if (key === 'status') setFilterStatus(value);
    if (key === 'label') setFilterLabel(value);
    if (key === 'type') setFilterType(value);
  };

  const syncAndNavigate = async (newPage: number) => {
    const success = await syncPending();
    if (success) fetchData(newPage);
  };

  const copyAiPrediction = (segment: SegmentResult) => {
    handleUserUpdate(segment.id, { user_label: segment.label, user_type: segment.type, is_labeled: true });
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    window.location.href = '/login';
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const segment = data[activeIndex];
      if (!segment) return;

      if (e.key === 's' || e.key === 'S') {
        handleUserUpdate(segment.id, { user_label: 'safe' });
      } else if (e.key === 'd' || e.key === 'D') {
        handleUserUpdate(segment.id, { user_label: 'danger' });
      } else if (e.key === 'c' || e.key === 'C') {
        copyAiPrediction(segment);
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        setActiveIndex(i => Math.min(i + 1, data.length - 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        setActiveIndex(i => Math.max(i - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [data, activeIndex]);

  const paginationControls = (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      <button disabled={pagination.currentPage <= 1 || loading} onClick={() => syncAndNavigate(pagination.currentPage - 1)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">&lt;</button>
      
      <div className="flex items-center gap-2">
        <span className="text-slate-500 font-normal">Trang</span>
        <input
          type="number"
          min={1}
          max={pagination.totalPages || 1}
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const p = parseInt(pageInput);
              if (!isNaN(p) && p >= 1 && p <= pagination.totalPages && p !== pagination.currentPage) {
                syncAndNavigate(p);
              } else {
                setPageInput(pagination.currentPage.toString());
              }
            }
          }}
          onBlur={() => {
            const p = parseInt(pageInput);
            if (!isNaN(p) && p >= 1 && p <= pagination.totalPages && p !== pagination.currentPage) {
              syncAndNavigate(p);
            } else {
              setPageInput(pagination.currentPage.toString());
            }
          }}
          className="w-14 rounded-md border border-slate-300 py-1 text-center text-sm font-semibold text-blue-700 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-slate-500 font-normal">/ {pagination.totalPages}</span>
      </div>

      <button disabled={pagination.currentPage >= pagination.totalPages || loading} onClick={() => syncAndNavigate(pagination.currentPage + 1)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">&gt;</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 text-slate-800 font-sans">
      <div className="mx-auto w-full">
        {/* HEADER */}
        <div className="mb-8 flex items-center justify-between gap-4">
          {/* Left: Title */}
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-slate-900 uppercase">Hệ thống gán nhãn</h1>
          </div>

          {/* Right: Filters + User */}
          <div className="flex items-center gap-3">
            {/* FILTER CONTROLS */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-100/50 p-2 shadow-sm">
              <div className="flex flex-col">
                <label className="mb-1 px-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Trạng thái</label>
                <CustomSelect
                  value={filterStatus}
                  onValueChange={(val) => handleFilterChange('status', val)}
                  placeholder="Lọc trạng thái"
                  className="h-[34px] w-[140px] border-0 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-blue-600"
                  options={[
                    { label: 'Tất cả', value: 'All' },
                    { label: 'Chưa gán nhãn', value: 'Unlabeled' },
                    { label: 'Đã gán nhãn', value: 'Labeled' },
                  ]}
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-1 px-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Nhãn</label>
                <CustomSelect
                  value={filterLabel}
                  onValueChange={(val) => handleFilterChange('label', val)}
                  placeholder="Lọc nhãn"
                  className="h-[34px] w-[150px] border-0 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-blue-600"
                  options={[
                    { label: 'Tất cả', value: 'All' },
                    { label: 'Không vi phạm', value: 'safe' },
                    { label: 'Vi phạm', value: 'danger' },
                  ]}
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-1 px-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Thể loại</label>
                <CustomSelect
                  value={filterType.toString()}
                  onValueChange={(val) => handleFilterChange('type', val === 'All' ? 'All' : Number(val))}
                  placeholder="Lọc thể loại"
                  className="h-[34px] w-[200px] border-0 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-blue-600"
                  options={[
                    { label: 'Tất cả', value: 'All' },
                    ...MOCK_TYPES.map(t => ({ label: t.name, value: t.id.toString() }))
                  ]}
                />
              </div>
              <div className="flex h-full flex-col justify-end pt-[18px]">
                <button title="Bộ lọc nâng cao" className="flex items-center justify-center rounded-md bg-slate-200 p-2 text-slate-600 hover:bg-slate-300 transition-colors">
                  <Filter className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* User Menu */}
            <UserMenu username={username} onLogout={handleLogout} />
          </div>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="mb-3 flex items-center gap-3 text-[11px] text-slate-400">
          <span>Phím tắt</span>
          {[['S', 'Không vi phạm'], ['D', 'Vi phạm'], ['C', 'Sử dụng kết quả AI'], ['↑↓', 'Di chuyển']].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1">
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 shadow-sm">{key}</kbd>
              <span>{label}</span>
            </span>
          ))}
        </div>

        {/* TABLE AND TOP PAGINATION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <span className="text-sm font-medium text-slate-500">
            Hiển thị <span className="text-slate-800">{data.length}</span> kết quả (Tổng: <span className="text-slate-800">{pagination.count}</span>)
          </span>
          {paginationControls}
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-slate-200">
          <div className="grid grid-cols-[60px_1fr_160px_220px_160px_140px] gap-6 border-b border-slate-200 bg-slate-50/80 px-6 py-4 text-xs font-bold tracking-wider text-slate-900 uppercase">
            <div className="text-center justify-center">STT</div>
            <div className="text-center justify-center">NỘI DUNG</div>
            <div className="text-center justify-center">KẾT QUẢ AI</div>
            <div className="text-center justify-center">NGƯỜI DÙNG XÁC NHẬN </div>
            <div className="text-center justify-center">GHI CHÚ</div>
            <div className="text-center justify-center">HÀNH ĐỘNG</div>
          </div>

          <div className="divide-y divide-slate-100 flex flex-col space-y-4 p-4 relative min-h-[300px]">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {!loading && data.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Không có đoạn nội dung nào khớp với bộ lọc của bạn.</div>
            ) : (
              data.map((segment, index) => {
                const isActive = index === activeIndex;
                const isLabeled = segment.is_labeled || !!pendingUpdates[segment.id];

                let borderColor = 'border-l-slate-300';
                if (segment.label === 'danger') borderColor = 'border-l-red-600';
                if (segment.label === 'safe') borderColor = 'border-l-green-400';

                return (
                  <div
                    key={segment.id}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "relative grid grid-cols-[60px_1fr_160px_220px_160px_140px] gap-6 items-center rounded-lg p-4 py-8 shadow-sm transition-all border border-l-[3px] cursor-pointer",
                      borderColor,
                      isActive
                        ? "border-blue-300 bg-blue-50/60 shadow-md ring-1 ring-blue-200"
                        : isLabeled
                          ? "border-slate-100 bg-green-50/40 hover:shadow-md"
                          : "border-slate-100 bg-white hover:shadow-md"
                    )}
                  >
                    {/* # Column */}
                    <div className="text-center font-medium text-slate-500 text-sm">
                      <div className="flex flex-col items-center gap-1">
                        {isLabeled && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          <span className="text-sm font-bold">{index + 1}</span>
                        <span className="text-[10px] text-slate-400">ID: {segment.id}</span>
                        <span className="text-[10px] text-slate-400">Đoạn {segment.segment_id}</span>
                      </div>
                    </div>

                    {/* Content Column */}
                    <div className="pr-4">
                      <p className="text-[15px] leading-relaxed text-slate-900">{segment.content}</p>
                      {segment.domain ? (
                        <a
                          href={segment.domain.startsWith('http') ? segment.domain : `https://${segment.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 inline-block text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-mono"
                          title={`Mở ${segment.domain} trong tab mới`}
                        >
                          {segment.domain}
                        </a>
                      ) : null}
                    </div>

                    {/* AI Intelligence Column */}
                    <div className="flex flex-col items-center gap-2 border-l border-slate-100 px-2 h-full justify-center text-center">
                      <AiBadge label={segment.label} />
                      <span className="text-sm font-medium text-slate-900 mt-1">{getTypeName(segment.type)}</span>
                    </div>

                    {/* User Verification Column */}
                    <div className="flex flex-col gap-3 px-2" onClick={e => e.stopPropagation()}>
                      <div className="flex w-full items-stretch rounded bg-slate-100 p-1 text-sm shadow-inner">
                        <button
                          onClick={() => handleUserUpdate(segment.id, { user_label: 'safe' })}
                          className={cn("flex-1 flex items-center justify-center rounded py-2 px-1 text-center font-semibold transition-all uppercase text-xs", segment.user_label === 'safe' ? "bg-green-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-200/50 hover:text-slate-900")}
                        >Không vi phạm</button>
                        <button
                          onClick={() => handleUserUpdate(segment.id, { user_label: 'danger' })}
                          className={cn("flex-1 flex items-center justify-center rounded py-2 px-1 text-center font-semibold transition-all uppercase text-xs", segment.user_label === 'danger' ? "bg-red-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-200/50 hover:text-slate-900")}
                        >Vi phạm</button>
                      </div>
                      <div className="relative">
                        <CustomSelect
                          value={segment.user_type?.toString()}
                          onValueChange={(val) => handleUserUpdate(segment.id, { user_type: val ? Number(val) : null })}
                          placeholder="Chọn thể loại"
                          className="w-full appearance-none rounded-md border-slate-300 bg-white border shadow-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 justify-between"
                          options={MOCK_TYPES.map(t => ({ label: t.name, value: t.id.toString() }))}
                        />
                        {segment.user_type !== null && segment.user_type !== segment.type && segment.type !== null && (
                          <div className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-white shadow-sm" title="Khác với AI">
                            <span className="text-[10px] font-bold">!</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Note Column */}
                    <div className="flex flex-col h-full" onClick={e => e.stopPropagation()}>
                      <textarea
                        className="w-full flex-1 resize-none rounded-md border-slate-300 bg-slate-50 p-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
                        placeholder="Ghi chú"
                        value={segment.note || ''}
                        onChange={(e) => handleUserUpdate(segment.id, { note: e.target.value })}
                      />
                    </div>

                    {/* Actions Column */}
                    <div className="flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => copyAiPrediction(segment)}
                        className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase"
                      >
                        <Copy className="h-3.5 w-3.5" />Sử dụng kết quả AI
                      </button>
                    </div>

                    {/* Delete button  */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(segment.id); }}
                      className="absolute top-2 right-2 flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors border border-red-100"
                      title="Xóa segment"
                    >
                      <Trash2 className="h-4 w-4" />
                      Xóa
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
            <span className="text-sm font-medium text-slate-500">
              Hiển thị <span className="text-slate-800">{data.length}</span> mục (Tổng: <span className="text-slate-800">{pagination.count}</span>)
            </span>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <button disabled={pagination.currentPage <= 1 || loading} onClick={() => syncAndNavigate(pagination.currentPage - 1)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">&lt;</button>
              
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-normal">Trang</span>
                <input
                  type="number"
                  min={1}
                  max={pagination.totalPages || 1}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const p = parseInt(pageInput);
                      if (!isNaN(p) && p >= 1 && p <= pagination.totalPages && p !== pagination.currentPage) {
                        syncAndNavigate(p);
                      } else {
                        setPageInput(pagination.currentPage.toString());
                      }
                    }
                  }}
                  onBlur={() => {
                    const p = parseInt(pageInput);
                    if (!isNaN(p) && p >= 1 && p <= pagination.totalPages && p !== pagination.currentPage) {
                      syncAndNavigate(p);
                    } else {
                      setPageInput(pagination.currentPage.toString());
                    }
                  }}
                  className="w-14 rounded-md border border-slate-300 py-1 text-center text-sm font-semibold text-blue-700 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-slate-500 font-normal">/ {pagination.totalPages}</span>
              </div>

              <button disabled={pagination.currentPage >= pagination.totalPages || loading} onClick={() => syncAndNavigate(pagination.currentPage + 1)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">&gt;</button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      <div className={cn(
        "fixed top-5 right-5 z-50 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-300",
        toast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none",
        toast?.type === 'error' ? "bg-red-600" : "bg-green-600"
      )}>
        {toast?.type === 'error'
          ? <AlertTriangle className="h-4 w-4" />
          : <CheckCircle2 className="h-4 w-4" />
        }
        {toast?.message}
      </div>

      {/* Floating submit bar */}
      <div className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
        Object.keys(pendingUpdates).length > 0
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "translate-y-4 opacity-0 pointer-events-none"
      )}>
        <div className="flex items-center gap-4 rounded-xl bg-slate-900 px-5 py-3 shadow-2xl border border-slate-700">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{Object.keys(pendingUpdates).length} thay đổi chưa lưu</span>
          </div>
          <div className="h-4 w-px bg-slate-600" />
          <button
            onClick={async () => { const ok = await syncPending(); if (ok) fetchData(pagination.currentPage); }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Gửi kết quả →
          </button>
        </div>
      </div>
    </div>
  );
};
