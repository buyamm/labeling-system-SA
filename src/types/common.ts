export interface User {
  id: string;
  name: string;
  email: string;
}

export type BaseResponse<T> = {
  data: T;
  message?: string;
  status: number;
};
