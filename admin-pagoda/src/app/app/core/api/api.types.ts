export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errorCode: number | null;
}
