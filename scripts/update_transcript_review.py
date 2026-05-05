#!/usr/bin/env python3
"""
Script to update TranscriptReview.tsx for MongoDB integration
"""
import re

file_path = 'src/features/labeling/components/TranscriptReview.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "import { AiLabel, SegmentResult } from '../types';",
    "import { Sentiment, AspectType, SegmentResult } from '../types';"
)

# 2. Replace MOCK_TYPES with SENTIMENTS and ASPECTS
mock_types_section = re.search(r'const MOCK_TYPES = \[.*?\];', content, re.DOTALL)
if mock_types_section:
    new_constants = """const SENTIMENTS: { value: Sentiment; label: string; color: string }[] = [
  { value: 'positive', label: 'Tích cực', color: 'bg-green-600' },
  { value: 'neutral',  label: 'Trung lập', color: 'bg-yellow-500' },
  { value: 'negative', label: 'Tiêu cực', color: 'bg-red-600' },
];

const ASPECTS: { value: AspectType; label: string }[] = [
  { value: 'Teaching_Skill',  label: 'Kỹ năng giảng dạy' },
  { value: 'Knowledge',       label: 'Kiến thức' },
  { value: 'Experience',      label: 'Kinh nghiệm' },
  { value: 'Behavior',        label: 'Thái độ' },
  { value: 'Support',         label: 'Hỗ trợ' },
  { value: 'Curriculum',      label: 'Chương trình học' },
  { value: 'Materials',       label: 'Tài liệu' },
  { value: 'Workload',        label: 'Khối lượng học tập' },
  { value: 'Assignments',     label: 'Bài tập' },
  { value: 'Grading',         label: 'Chấm điểm' },
  { value: 'Exams',           label: 'Thi cử' },
  { value: 'Classroom',       label: 'Phòng học / CSVC' },
  { value: 'Platforms',       label: 'Nền tảng học tập' },
  { value: 'General',         label: 'Tổng quan' },
  { value: 'Recommendation',  label: 'Đề xuất' },
];

const getSentimentConfig = (s: Sentiment | null | undefined) =>
  SENTIMENTS.find(x => x.value === s) ?? null;

const getAspectLabel = (a: AspectType | null | undefined) =>
  ASPECTS.find(x => x.value === a)?.label ?? (a || 'Chưa phân loại');"""
    content = content.replace(mock_types_section.group(0), new_constants)

# 3. Replace getTypeName
content = re.sub(
    r'const getTypeName = \(typeId: number \| null\) => \{.*?\};',
    '',
    content,
    flags=re.DOTALL
)

# 4. Replace AiBadge with SentimentBadge
content = content.replace('const AiBadge', 'const SentimentBadge')
content = content.replace('({ label }:', '({ sentiment }:')
content = content.replace('label: string | null | undefined', 'sentiment: Sentiment | null | undefined')

# 5. Update state declarations
content = content.replace(
    "const [filterLabel, setFilterLabel] = useState<AiLabel | 'All'>('All');",
    "const [filterSentiment, setFilterSentiment] = useState<Sentiment | 'All'>('All');"
)
content = content.replace(
    "const [filterType, setFilterType] = useState<number | 'All'>('All');",
    "const [filterAspect, setFilterAspect] = useState<AspectType | 'All'>('All');"
)
content = content.replace(
    "const [pendingUpdates, setPendingUpdates] = useState<Record<number, Partial<SegmentResult>>>({});",
    "const [pendingUpdates, setPendingUpdates] = useState<Record<string, Partial<SegmentResult>>>({});"
)

# 6. Update handleUserUpdate signature
content = content.replace(
    "const handleUserUpdate = (id: number,",
    "const handleUserUpdate = (id: string,"
)

# 7. Update handleDelete to async and call API
old_delete = re.search(r'const handleDelete = \(id: number\) => \{.*?setPendingUpdates\(prev => \{ const next = \{ \.\.\.prev \}; delete next\[id\]; return next; \}\);.*?\};', content, re.DOTALL)
if old_delete:
    new_delete = """const handleDelete = async (id: string) => {
    if (!window.confirm(`Xóa segment #${id}?`)) return;
    try {
      await segmentApi.deleteSegment(id);
      setData(prev => prev.filter(item => item.id !== id));
      setPendingUpdates(prev => { const next = { ...prev }; delete next[id]; return next; });
      showToast('Đã xóa segment');
    } catch (err) {
      console.error('Failed to delete:', err);
      showToast('Lỗi khi xóa segment', 'error');
    }
  };"""
    content = content.replace(old_delete.group(0), new_delete)

# 8. Update syncPending
content = content.replace(
    "const idsToSync = Object.keys(pendingUpdates).map(Number);",
    "const idsToSync = Object.keys(pendingUpdates);"
)
content = content.replace(
    "!seg!.user_label || seg!.user_type === null || seg!.user_type === undefined",
    "!seg!.user_sentiment || !seg!.user_aspect"
)
content = content.replace(
    "chưa điền đủ [Nhãn] và [Thể loại]!",
    "chưa điền đủ [Cảm xúc] và [Khía cạnh]!"
)

# 9. Update copyAiPrediction
old_copy = "handleUserUpdate(segment.id, { user_label: segment.label, user_type: segment.type, is_labeled: true });"
new_copy = """handleUserUpdate(segment.id, {
      user_sentiment: segment.sentiment,
      user_aspect: segment.aspect,
      note: 'Giữ nguyên kết quả AI',
      is_labeled: true,
    });"""
content = content.replace(old_copy, new_copy)

# 10. Update keyboard shortcuts
content = content.replace("e.key === 's' || e.key === 'S'", "e.key === 'p' || e.key === 'P'")
content = content.replace("handleUserUpdate(segment.id, { user_label: 'safe' });", "handleUserUpdate(segment.id, { user_sentiment: 'positive', note: 'Đã check tay' });")
content = content.replace("e.key === 'd' || e.key === 'D'", "e.key === 'n' || e.key === 'N'")
content = content.replace("handleUserUpdate(segment.id, { user_label: 'danger' });", "handleUserUpdate(segment.id, { user_sentiment: 'negative', note: 'Đã check tay' });")

# Add neutral shortcut
content = content.replace(
    "handleUserUpdate(segment.id, { user_sentiment: 'negative', note: 'Đã check tay' });",
    """handleUserUpdate(segment.id, { user_sentiment: 'negative', note: 'Đã check tay' });
      } else if (e.key === 'u' || e.key === 'U') {
        handleUserUpdate(segment.id, { user_sentiment: 'neutral', note: 'Đã check tay' });"""
)

# 11. Update filter params
content = content.replace("filterLabel", "filterSentiment")
content = content.replace("filterType", "filterAspect")
content = content.replace("user_label", "user_sentiment")
content = content.replace("user_type", "user_aspect")
content = content.replace("queryParams.label", "queryParams.sentiment")
content = content.replace("queryParams.type", "queryParams.aspect")

# 12. Update keyboard hints
content = content.replace("[['S', 'Không vi phạm'], ['D', 'Vi phạm']", "[['P', 'Tích cực'], ['N', 'Tiêu cực'], ['U', 'Trung lập']")

# 13. Update filter labels
content = content.replace('<label className="mb-1 px-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Nhãn</label>', '<label className="mb-1 px-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Cảm xúc</label>')
content = content.replace('<label className="mb-1 px-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Thể loại</label>', '<label className="mb-1 px-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Khía cạnh</label>')

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Updated TranscriptReview.tsx successfully!")
