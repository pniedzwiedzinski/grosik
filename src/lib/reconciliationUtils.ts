import type { TransactionEntry, MatchGroup } from '@/types/reconciliation';

export const autoMatchEntries = (
  bankEntries: TransactionEntry[],
  bookkeepingEntries: TransactionEntry[]
): { updatedBankEntries: TransactionEntry[]; updatedBookkeepingEntries: TransactionEntry[]; newMatches: MatchGroup[] } => {
  const updatedBankEntries = bankEntries.map(entry => ({ ...entry, status: entry.status === 'matched' ? 'matched' : 'unmatched', matchId: entry.status === 'matched' ? entry.matchId : undefined }));
  const updatedBookkeepingEntries = bookkeepingEntries.map(entry => ({ ...entry, status: entry.status === 'matched' ? 'matched' : 'unmatched', matchId: entry.status === 'matched' ? entry.matchId : undefined }));
  const newMatches: MatchGroup[] = [];

  const bookEntriesMap = new Map<string, TransactionEntry[]>();
  updatedBookkeepingEntries.forEach(entry => {
    if (entry.status === 'unmatched') {
      const key = `${entry.date}_${entry.amount.toFixed(2)}`;
      if (!bookEntriesMap.has(key)) {
        bookEntriesMap.set(key, []);
      }
      bookEntriesMap.get(key)!.push(entry);
    }
  });

  for (const bankEntry of updatedBankEntries) {
    if (bankEntry.status === 'unmatched') {
      const key = `${bankEntry.date}_${bankEntry.amount.toFixed(2)}`;
      const potentialMatches = bookEntriesMap.get(key);

      if (potentialMatches && potentialMatches.length > 0) {
        const bookEntry = potentialMatches.shift(); // Take the first available match
        if (bookEntry && bookEntry.status === 'unmatched') {
          const matchId = `auto-${crypto.randomUUID()}`;
          bankEntry.status = 'matched';
          bankEntry.matchId = matchId;
          bankEntry.matchedEntryDetails = [{ id: bookEntry.id, date: bookEntry.date, description: bookEntry.description, amount: bookEntry.amount, source: bookEntry.source }];
          
          bookEntry.status = 'matched';
          bookEntry.matchId = matchId;
          bookEntry.matchedEntryDetails = [{ id: bankEntry.id, date: bankEntry.date, description: bankEntry.description, amount: bankEntry.amount, source: bankEntry.source }];

          newMatches.push({
            id: matchId,
            type: 'auto',
            bankEntryIds: [bankEntry.id],
            bookkeepingEntryIds: [bookEntry.id],
          });

          // If no more potential matches for this key, remove it
          if (potentialMatches.length === 0) {
            bookEntriesMap.delete(key);
          }
        }
      }
    }
  }
  return { updatedBankEntries, updatedBookkeepingEntries, newMatches };
};

export const manuallyMatchEntries = (
  selectedBankIds: string[],
  selectedBookkeepingIds: string[],
  allBankEntries: TransactionEntry[],
  allBookkeepingEntries: TransactionEntry[]
): { updatedBankEntries: TransactionEntry[]; updatedBookkeepingEntries: TransactionEntry[]; newMatch: MatchGroup | null } => {
  if (selectedBankIds.length === 0 || selectedBookkeepingIds.length === 0) {
    // Allow matching multiple bank to multiple bookkeeping, or bank to book, book to bank
    if(selectedBankIds.length > 0 && selectedBookkeepingIds.length === 0 && selectedBankIds.length < 2 ) return { updatedBankEntries: allBankEntries, updatedBookkeepingEntries: allBookkeepingEntries, newMatch: null };
    if(selectedBookkeepingIds.length > 0 && selectedBankIds.length === 0 && selectedBookkeepingIds.length < 2) return { updatedBankEntries: allBankEntries, updatedBookkeepingEntries: allBookkeepingEntries, newMatch: null };
    if(selectedBankIds.length === 0 && selectedBookkeepingIds.length === 0) return { updatedBankEntries: allBankEntries, updatedBookkeepingEntries: allBookkeepingEntries, newMatch: null };
    // The specific case of one-to-many or many-to-one needs at least one from each side, or multiple from one side to one on the other.
    // The current prompt states "manually match multiple entries to a single entry", 
    // implying one side must be singular for this specific feature variant.
    // For more general N:M matching, this check would be different.
    // Given the prompt, if either selection is empty, or if we try to match N from bank to M from book where N>1 and M>1, it might be out of scope or handled differently.
    // The spirit of "multiple entries to a single entry" typically means N:1 or 1:M.
    // Let's assume generic N:M matching is allowed.
  }


  const matchId = `manual-${crypto.randomUUID()}`;
  const matchedBankEntriesDetails: Partial<TransactionEntry>[] = [];
  const matchedBookkeepingEntriesDetails: Partial<TransactionEntry>[] = [];

  const newAllBankEntries = allBankEntries.map(entry => {
    if (selectedBankIds.includes(entry.id)) {
      matchedBankEntriesDetails.push({id: entry.id, date: entry.date, description: entry.description, amount: entry.amount, source: entry.source});
      return { ...entry, status: 'matched' as 'matched', matchId };
    }
    return entry;
  });

  const newAllBookkeepingEntries = allBookkeepingEntries.map(entry => {
    if (selectedBookkeepingIds.includes(entry.id)) {
      matchedBookkeepingEntriesDetails.push({id: entry.id, date: entry.date, description: entry.description, amount: entry.amount, source: entry.source});
      return { ...entry, status: 'matched' as 'matched', matchId };
    }
    return entry;
  });
  
  // Populate matchedEntryDetails for all involved entries
  const allMatchedDetails = [...matchedBankEntriesDetails, ...matchedBookkeepingEntriesDetails];

  const finalBankEntries = newAllBankEntries.map(entry => {
    if (selectedBankIds.includes(entry.id)) {
      return { ...entry, matchedEntryDetails: allMatchedDetails.filter(detail => detail.id !== entry.id) };
    }
    return entry;
  });

  const finalBookkeepingEntries = newAllBookkeepingEntries.map(entry => {
    if (selectedBookkeepingIds.includes(entry.id)) {
      return { ...entry, matchedEntryDetails: allMatchedDetails.filter(detail => detail.id !== entry.id) };
    }
    return entry;
  });
  
  const newMatch: MatchGroup = {
    id: matchId,
    type: 'manual',
    bankEntryIds: selectedBankIds,
    bookkeepingEntryIds: selectedBookkeepingIds,
  };

  return { updatedBankEntries: finalBankEntries, updatedBookkeepingEntries: finalBookkeepingEntries, newMatch };
};


export const unmatchEntriesByMatchId = (
  matchIdToUnmatch: string,
  allBankEntries: TransactionEntry[],
  allBookkeepingEntries: TransactionEntry[]
): { updatedBankEntries: TransactionEntry[]; updatedBookkeepingEntries: TransactionEntry[] } => {
  const updatedBankEntries = allBankEntries.map(entry => {
    if (entry.matchId === matchIdToUnmatch) {
      return { ...entry, status: 'unmatched' as 'unmatched', matchId: undefined, matchedEntryDetails: undefined };
    }
    return entry;
  });

  const updatedBookkeepingEntries = allBookkeepingEntries.map(entry => {
    if (entry.matchId === matchIdToUnmatch) {
      return { ...entry, status: 'unmatched' as 'unmatched', matchId: undefined, matchedEntryDetails: undefined };
    }
    return entry;
  });

  return { updatedBankEntries, updatedBookkeepingEntries };
};
