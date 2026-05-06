export type Sentiment = 'negative' | 'neutral' | 'positive';

export type AspectType =
  | 'ky_nang_giang_day'
  | 'kinh_nghiem'
  | 'hanh_vi'
  | 'bai_tap'
  | 'cham_diem'
  | 'cung_cap_tai_lieu'
  | 'kien_thuc'
  | 'chuong_trinh_hoc'
  | 'thiet_bi_day_hoc'
  | 'de_xuat'
  | 'noi_chung';

export interface ContentType {
  id: string;
  name: string;
}

export interface SegmentResult {
  id: string;           // MongoDB ObjectId as string
  text: string;
  aspect: AspectType | null;
  sentiment: Sentiment | null;
  confidence: number;
  entity: string | null;
  aspect_raw: string | null;
  user_aspect: AspectType | null;
  user_sentiment: Sentiment | null;
  note: string | null;
  is_labeled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  current_page: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CollectionInfo {
  name: string;
  count: number;
}
