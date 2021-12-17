/**
 * Normalized row for export; each bank should return this.
 */
export type NormalizedRow = {
  account: string,
  date: string, 
  payee: string, 
  note: string, 
  amount: number, 
  amountInCurrency: number | null,
  currency: string, 
}