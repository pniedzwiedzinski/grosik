
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
        const bookEntry = potentialMatches.shift(); 
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
    return { updatedBankEntries: allBankEntries, updatedBookkeepingEntries: allBookkeepingEntries, newMatch: null };
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
