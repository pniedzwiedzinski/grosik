
import type { TransactionEntry, MatchGroup } from '@/types/reconciliation';

// Helper function to calculate string similarity using trigram-based Jaccard similarity
const calculateStringSimilarity = (str1: string, str2: string): number => {
  // Normalize strings: lowercase and remove non-alphanumeric characters
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s1 = normalize(str1);
  const s2 = normalize(str2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Generate trigrams for a string
  const getTrigrams = (s: string): Set<string> => {
    const trigrams = new Set<string>();
    for (let i = 0; i <= s.length - 3; i++) {
      trigrams.add(s.substring(i, i + 3));
    }
    return trigrams;
  };

  const trigrams1 = getTrigrams(s1);
  const trigrams2 = getTrigrams(s2);

  // Count common trigrams
  let common = 0;
  for (const trigram of trigrams1) {
    if (trigrams2.has(trigram)) common++;
  }

  // Calculate Jaccard similarity: intersection / union
  const total = trigrams1.size + trigrams2.size - common;
  return total > 0 ? common / total : 0;
};

export const autoMatchEntries = (
  bankEntries: TransactionEntry[],
  ziherEntries: TransactionEntry[]
): { updatedBankEntries: TransactionEntry[]; updatedZiherEntries: TransactionEntry[]; newMatches: MatchGroup[] } => {
  // Work on copies to modify status and matchId
  const modifiableBankEntries = bankEntries.map(entry => ({
    ...entry,
    status: (entry.status === 'matched' ? 'matched' : 'unmatched') as 'matched' | 'unmatched',
    matchId: entry.status === 'matched' ? entry.matchId : undefined,
    matchedEntryDetails: entry.matchedEntryDetails || []
  }));
  const modifiableZiherEntries = ziherEntries.map(entry => ({
    ...entry,
    status: (entry.status === 'matched' ? 'matched' : 'unmatched') as 'matched' | 'unmatched',
    matchId: entry.status === 'matched' ? entry.matchId : undefined,
    matchedEntryDetails: entry.matchedEntryDetails || []
  }));

  const newMatches: MatchGroup[] = [];

  for (let i = 0; i < modifiableBankEntries.length; i++) {
    const bankEntry = modifiableBankEntries[i];
    if (bankEntry.status === 'matched') {
      continue;
    }

    const potentialZiherMatches = modifiableZiherEntries.filter(
      ze => ze.status === 'unmatched' && ze.amount.toFixed(2) === bankEntry.amount.toFixed(2)
    );

    if (potentialZiherMatches.length === 0) {
      continue;
    }

    let bestZiherMatch: TransactionEntry | null = null;

    if (potentialZiherMatches.length === 1) {
      bestZiherMatch = potentialZiherMatches[0];
    } else {
      // Multiple potential matches - calculate description similarity scores
      const similarityScores = potentialZiherMatches.map(entry =>
        calculateStringSimilarity(bankEntry.description, entry.description)
      );

      // Find max similarity score
      const maxScore = Math.max(...similarityScores);

      // Find the first entry with max similarity score
      const bestMatchIndex = similarityScores.findIndex(score => score === maxScore);
      bestZiherMatch = potentialZiherMatches[bestMatchIndex];
    }

    if (bestZiherMatch) {
      const matchId = `auto-${crypto.randomUUID()}`;

      bankEntry.status = 'matched';
      bankEntry.matchId = matchId;
      bankEntry.matchedEntryDetails = [{
        id: bestZiherMatch.id,
        date: bestZiherMatch.date,
        description: bestZiherMatch.description,
        amount: bestZiherMatch.amount,
        source: bestZiherMatch.source
      }];

      const ziherEntryIndex = modifiableZiherEntries.findIndex(ze => ze.id === bestZiherMatch!.id);
      if (ziherEntryIndex !== -1) {
        modifiableZiherEntries[ziherEntryIndex].status = 'matched';
        modifiableZiherEntries[ziherEntryIndex].matchId = matchId;
        modifiableZiherEntries[ziherEntryIndex].matchedEntryDetails = [{
          id: bankEntry.id,
          date: bankEntry.date,
          description: bankEntry.description,
          amount: bankEntry.amount,
          source: bankEntry.source
        }];
      }

      newMatches.push({
        id: matchId,
        type: 'auto',
        bankEntryIds: [bankEntry.id],
        ziherEntryIds: [bestZiherMatch.id],
        bankSumInMatch: bankEntry.amount,
        ziherSumInMatch: bestZiherMatch.amount,
        isDiscrepancy: bankEntry.amount.toFixed(2) !== bestZiherMatch.amount.toFixed(2),
      });
    }
  }
  return { updatedBankEntries: modifiableBankEntries, updatedZiherEntries: modifiableZiherEntries, newMatches };
};

export const manuallyMatchEntries = (
  selectedBankIds: string[],
  selectedZiherIds: string[],
  allBankEntries: TransactionEntry[],
  allZiherEntries: TransactionEntry[],
  sumBankSelected: number,
  sumZiherSelected: number
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
      matchedBankEntriesDetails.push({ id: entry.id, date: entry.date, description: entry.description, amount: entry.amount, source: entry.source });
      return { ...entry, status: 'matched' as 'matched', matchId };
    }
    return entry;
  });

  const newAllZiherEntries = allZiherEntries.map(entry => {
    if (selectedZiherIds.includes(entry.id)) {
      matchedZiherEntriesDetails.push({ id: entry.id, date: entry.date, description: entry.description, amount: entry.amount, source: entry.source });
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
    bankSumInMatch: sumBankSelected,
    ziherSumInMatch: sumZiherSelected,
    isDiscrepancy: sumBankSelected.toFixed(2) !== sumZiherSelected.toFixed(2),
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
      return { ...entry, status: 'unmatched' as 'unmatched', matchId: undefined, matchedEntryDetails: [] };
    }
    return entry;
  });

  const updatedZiherEntries = allZiherEntries.map(entry => {
    if (entry.matchId === matchIdToUnmatch) {
      return { ...entry, status: 'unmatched' as 'unmatched', matchId: undefined, matchedEntryDetails: [] };
    }
    return entry;
  });

  return { updatedBankEntries, updatedZiherEntries };
};
