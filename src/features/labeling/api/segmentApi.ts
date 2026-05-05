import { SegmentResult, PaginatedResponse } from '../types';

// ---------------------------------------------------------------------------
// API client — calls Next.js API routes which talk to MongoDB Atlas
// ---------------------------------------------------------------------------

export interface GetSegmentsParams {
  page?: number;
  is_labeled?: boolean | string;
  sentiment?: string;
  aspect?: string;
  user_sentiment?: string;
  user_aspect?: string;
}

const BASE = '/api/segments';

/** Build query string, omitting undefined / 'All' values */
function buildQuery(params: Record<string, any>): string {
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null || val === 'All') continue;
    q.set(key, String(val));
  }
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const segmentApi = {
  /** GET /api/segments — paginated list with filters */
  getSegments: (params: GetSegmentsParams): Promise<PaginatedResponse<SegmentResult>> => {
    const qs = buildQuery(params as Record<string, any>);
    return apiFetch<PaginatedResponse<SegmentResult>>(`${BASE}${qs}`);
  },

  /** PATCH /api/segments/:id — update a single segment */
  updateSegment: (id: string, data: Partial<SegmentResult>): Promise<SegmentResult> => {
    return apiFetch<SegmentResult>(`${BASE}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /** POST /api/segments/bulk-update — update multiple segments at once */
  bulkUpdateSegments: (
    updates: Array<Partial<SegmentResult> & { id: string }>
  ): Promise<{ updated: number }> => {
    return apiFetch<{ updated: number }>(`${BASE}/bulk-update`, {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  },

  /** DELETE /api/segments/:id */
  deleteSegment: (id: string): Promise<{ success: boolean }> => {
    return apiFetch<{ success: boolean }>(`${BASE}/${id}`, {
      method: 'DELETE',
    });
  },
};
