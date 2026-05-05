export type AiLabel = 'safe' | 'danger';

export interface ContentType {
  id: number;
  name: string;
}

export interface SegmentResult {
  id: number;
  domain: string;
  segment_id: number;
  content: string;
  label: AiLabel;
  type: number | null;
  note: string | null;
  user_label: 'safe' | 'danger' | null;
  user_type: number | null;
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