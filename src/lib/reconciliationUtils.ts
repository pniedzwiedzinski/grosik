
import type { TransactionEntry, MatchGroup } from '@/types/reconciliation';

export const autoMatchEntries = (
  bankEntries: TransactionEntry[],
  ziherEntries: TransactionEntry[]
): { updatedBankEntries: TransactionEntry[]; updatedZiherEntries: TransactionEntry[]; newMatches: MatchGroup[] } => {
  const updatedBankEntries = bankEntries.map(entry => ({ ...entry, status: entry.status === 'matched' ? 'matched' : 'unmatched', matchId: entry.status === 'matched' ? entry.matchId : undefined }));
  const updatedZiherEntries = ziherEntries.map(entry => ({ ...entry, status: entry.status === 'matched' ? 'matched' : 'unmatched', matchId: entry.status === 'matched' ? entry.matchId : undefined }));
  const newMatches: MatchGroup[] = [];

  const ziherEntriesMap = new Map<string, TransactionEntry[]>();
  updatedZiherEntries.forEach(entry => {
    if (entry.status === 'unmatched') {
      const key = `${entry.date}_${entry.amount.toFixed(2)}`;
      if (!ziherEntriesMap.has(key)) {
        ziherEntriesMap.set(key, []);
      }
      ziherEntriesMap.get(key)!.push(entry);
    }
  });

  for (const bankEntry of updatedBankEntries) {
    if (bankEntry.status === 'unmatched') {
      const key = `${bankEntry.date}_${bankEntry.amount.toFixed(2)}`;
      const potentialMatches = ziherEntriesMap.get(key);

      if (potentialMatches && potentialMatches.length > 0) {
        const ziherEntry = potentialMatches.shift(); 
        if (ziherEntry && ziherEntry.status === 'unmatched') {
          const matchId = `auto-${crypto.randomUUID()}`;
          bankEntry.status = 'matched';
          bankEntry.matchId = matchId;
          bankEntry.matchedEntryDetails = [{ id: ziherEntry.id, date: ziherEntry.date, description: ziherEntry.description, amount: ziherEntry.amount, source: ziherEntry.source }];
          
          ziherEntry.status = 'matched';
          ziherEntry.matchId = matchId;
          ziherEntry.matchedEntryDetails = [{ id: bankEntry.id, date: bankEntry.date, description: bankEntry.description, amount: bankEntry.amount, source: bankEntry.source }];

          newMatches.push({
            id: matchId,
            type: 'auto',
            bankEntryIds: [bankEntry.id],
            ziherEntryIds: [ziherEntry.id],
          });

          if (potentialMatches.length === 0) {
            ziherEntriesMap.delete(key);
          }
        }
      }
    }
  }
  return { updatedBankEntries, updatedZiherEntries, newMatches };
};

export const manuallyMatchEntries = (
  selectedBankIds: string[],
  selectedZiherIds: string[],
  allBankEntries: TransactionEntry[],
  allZiherEntries: TransactionEntry[]
): { updatedBankEntries: TransactionEntry[]; updatedZiherEntries: TransactionEntry[]; newMatch: MatchGroup | null } => {
  
  const bankEntriesToMatchAreUnmatched = selectedBankIds.every(id => {
    const entry = allBankEntries.find(e => e.id === id);
    return entry && entry.status === 'unmatched';
  });
  const ziherEntriesToMatchAreUnmatched = selectedZiherIds.every(id => {
    const entry = allZiherEntries.find(e => e.id === id);
    return entry && entry.status === 'unmatched';
  });

  if (selectedBankIds.length === 0 || 
      selectedZiherIds.length === 0 || 
      !bankEntriesToMatchAreUnmatched || 
      !ziherEntriesToMatchAreUnmatched) {
    return { updatedBankEntries: allBankEntries, updatedZiherEntries: allZiherEntries, newMatch: null };
  }

  const matchId = `manual-${crypto.randomUUID()}`;
  const matchedBankEntriesDetails: Partial<TransactionEntry>[] = [];
  const matchedZiherEntriesDetails: Partial<TransactionEntry>[] = [];

  const newAllBankEntries = allBankEntries.map(entry => {
    if (selectedBankIds.includes(entry.id)) {
      matchedBankEntriesDetails.push({id: entry.id, date: entry.date, description: entry.description, amount: entry.amount, source: entry.source});
      return { ...entry, status: 'matched' as 'matched', matchId };
    }
    return entry;
  });

  const newAllZiherEntries = allZiherEntries.map(entry => {
    if (selectedZiherIds.includes(entry.id)) {
      matchedZiherEntriesDetails.push({id: entry.id, date: entry.date, description: entry.description, amount: entry.amount, source: entry.source});
      return { ...entry, status: 'matched' as 'matched', matchId };
    }
    return entry;
  });
  
  const allMatchedDetails = [...matchedBankEntriesDetails, ...matchedZiherEntriesDetails];

  const finalBankEntries = newAllBankEntries.map(entry => {
    if (selectedBankIds.includes(entry.id)) {
      return { ...entry, matchedEntryDetails: allMatchedDetails.filter(detail => detail.id !== entry.id) };
    }
    return entry;
  });

  const finalZiherEntries = newAllZiherEntries.map(entry => {
    if (selectedZiherIds.includes(entry.id)) {
      return { ...entry, matchedEntryDetails: allMatchedDetails.filter(detail => detail.id !== entry.id) };
    }
    return entry;
  });
  
  const newMatch: MatchGroup = {
    id: matchId,
    type: 'manual',
    bankEntryIds: selectedBankIds,
    ziherEntryIds: selectedZiherIds,
  };

  return { updatedBankEntries: finalBankEntries, updatedZiherEntries: finalZiherEntries, newMatch };
};


export const unmatchEntriesByMatchId = (
  matchIdToUnmatch: string,
  allBankEntries: TransactionEntry[],
  allZiherEntries: TransactionEntry[]
): { updatedBankEntries: TransactionEntry[]; updatedZiherEntries: TransactionEntry[] } => {
  const updatedBankEntries = allBankEntries.map(entry => {
    if (entry.matchId === matchIdToUnmatch) {
      return { ...entry, status: 'unmatched' as 'unmatched', matchId: undefined, matchedEntryDetails: undefined };
    }
    return entry;
  });

  const updatedZiherEntries = allZiherEntries.map(entry => {
    if (entry.matchId === matchIdToUnmatch) {
      return { ...entry, status: 'unmatched' as 'unmatched', matchId: undefined, matchedEntryDetails: undefined };
    }
    return entry;
  });

  return { updatedBankEntries, updatedZiherEntries };
};
