export type Sentiment = 'negative' | 'neutral' | 'positive';

export type AspectType =
  | 'Teaching_Skill'
  | 'Knowledge'
  | 'Experience'
  | 'Behavior'
  | 'Support'
  | 'Curriculum'
  | 'Materials'
  | 'Workload'
  | 'Assignments'
  | 'Grading'
  | 'Exams'
  | 'Classroom'
  | 'Platforms'
  | 'General'
  | 'Recommendation';

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