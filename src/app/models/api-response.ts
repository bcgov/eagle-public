export interface DataQueryResponse<T> {
  results: T[],
  total_items: number,
  _id: string,
  read: string[]
}
