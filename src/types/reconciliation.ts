export interface TransactionEntry {
  id: string; // Unique ID, e.g., `${source}-${rowIndex}` or UUID
  date: string; 
  description: string;
  amount: number;
  source: 'bank' | 'bookkeeping';
  status: 'unmatched' | 'matched' | 'candidate'; // 'candidate' for items selected for manual matching
  matchId?: string; // ID of the match group this entry belongs to
  originalRowData: string[]; // Raw row data for reference during display or debugging
  matchedEntryDetails?: Partial<TransactionEntry>[]; // Details of entries it's matched with
}

export interface MatchGroup {
  id: string;
  type: 'auto' | 'manual';
  bankEntryIds: string[];
  bookkeepingEntryIds: string[];
  // Optional: store total amounts if needed for verification
  // totalBankAmount: number;
  // totalBookkeepingAmount: number;
}
