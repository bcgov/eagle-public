export interface DataQueryResponse<T> {
  results: T[],
  total_items: Number,
  _id: string,
  read: string[]
}
