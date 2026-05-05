import { SegmentResult, PaginatedResponse } from '../types';


const BASE_URL = process.env.NEXT_PUBLIC_API_URL ;

// Hàm lấy token từ localStorage 
const getAuthHeaders = (): Record<string, string> => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token'); 
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
  return {};
};

export interface GetSegmentsParams {
  page?: number;
  is_labeled?: boolean | string;
  label?: string;
  type?: number | string;
  user_label?: string;
  user_type?: number | string;
}

export const segmentApi = {
  getSegments: async (params: GetSegmentsParams): Promise<PaginatedResponse<SegmentResult>> => {
    const url = new URL(`${BASE_URL}/labeling/segments/`);
    
    if (params.page) url.searchParams.append('page', params.page.toString());
    if (params.is_labeled !== undefined && params.is_labeled !== 'All') {
      url.searchParams.append('is_labeled', params.is_labeled.toString());
    }
    if (params.label && params.label !== 'All') {
      url.searchParams.append('label', params.label);
    }
    if (params.type !== undefined && params.type !== 'All') {
      url.searchParams.append('type', params.type.toString());
    }
    if (params.user_label && params.user_label !== 'All') {
      url.searchParams.append('user_label', params.user_label);
    }
    if (params.user_type !== undefined && params.user_type !== 'All') {
      url.searchParams.append('user_type', params.user_type.toString());
    }

    const authHeaders = getAuthHeaders();
    if (!authHeaders.Authorization) {
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('No authentication token found. Redirecting to login.');
    }

    const res = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      }
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        }
      }
      throw new Error(`Failed to fetch segments: ${res.status}`);
    }

    return res.json();
  },

  updateSegment: async (id: number, data: Partial<SegmentResult>): Promise<SegmentResult> => {
    const res = await fetch(`${BASE_URL}/labeling/segments/${id}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to update segment: ${res.status}`);
    }

    return res.json();
  },

  bulkUpdateSegments: async (updates: Array<Partial<SegmentResult> & { id: number }>): Promise<any> => {
    const authHeaders = getAuthHeaders();
    if (!authHeaders.Authorization) {
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('No authentication token found. Redirecting to login.');
    }

    // Mapping sang đúng Schema yêu cầu của backend
    const formattedLabels = updates.map(update => {
      const mappedRecord: any = { id: update.id };
      if (update.user_label !== undefined) mappedRecord.label = update.user_label;
      if (update.user_type !== undefined) mappedRecord.type = update.user_type;
      if (update.note !== undefined) mappedRecord.note = update.note;
      return mappedRecord;
    });

    const res = await fetch(`${BASE_URL}/labeling/segments/bulk-label/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ labels: formattedLabels }),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
         if (typeof window !== 'undefined') {
           localStorage.removeItem('access_token');
           window.location.href = '/login';
         }
      }
      let errorData = '';
      try {
        errorData = await res.text();
      } catch (e) {}
      throw new Error(`Failed to bulk update segments: ${res.status}. Data: ${errorData}`);
    }

    // Try to parse json, if it fails (e.g., 204 No Content), return an empty object
    try {
      return await res.json();
    } catch (e) {
      return {};
    }
  }
};