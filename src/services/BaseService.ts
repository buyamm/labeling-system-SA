// Base class hoặc function cho các Services gọi API
import { API_URL } from '@/config/env';

export class BaseService {
  protected baseUrl: string;

  constructor(endpoint: string) {
    this.baseUrl = `${API_URL}${endpoint}`;
  }

  // Các methods Http mặc định (GET, POST, PUT, DELETE) sẽ được viết dùng chung tại đây
}
