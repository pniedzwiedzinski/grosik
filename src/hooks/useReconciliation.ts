import { useState, useEffect, useCallback } from 'react';
import type { TransactionEntry, MatchGroup } from '@/types/reconciliation';
import { parseCsv } from '@/lib/csvParser';
import { autoMatchEntries, manuallyMatchEntries, unmatchEntriesByMatchId } from '@/lib/reconciliationUtils';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, sortEntriesByDate, searchFilterEntries } from '@/lib/formatUtils';

type FilterMode = 'all' | 'income' | 'expenses';

export default function useReconciliation() {
    const { toast } = useToast();

    const [bankEntries, setBankEntries] = useState<TransactionEntry[]>([]);
    const [ziherEntries, setZiherEntries] = useState<TransactionEntry[]>([]);
    const [selectedBankEntryIds, setSelectedBankEntryIds] = useState<string[]>([]);
    const [selectedZiherEntryIds, setSelectedZiherEntryIds] = useState<string[]>([]);
    const [unmatchedCombinedEntries, setUnmatchedCombinedEntries] = useState<TransactionEntry[]>([]);
    const [matchGroups, setMatchGroups] = useState<MatchGroup[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [bankTotal, setBankTotal] = useState(0);
    const [ziherTotal, setZiherTotal] = useState(0);
    const [difference, setDifference] = useState(0);
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
    const [isMismatchConfirmDialogOpen, setIsMismatchConfirmDialogOpen] = useState(false);
    const [mismatchConfirmData, setMismatchConfirmData] = useState<{
        bankIds: string[];
        ziherIds: string[];
        bankSum: number;
        ziherSum: number;
    } | null>(null);

    const updateProgress = useCallback(async (value: number) => {
        setProgress(value);
        await new Promise(resolve => setTimeout(resolve, 30));
    }, [setProgress]);

    const filterEntriesByMode = (entries: TransactionEntry[], mode: FilterMode): TransactionEntry[] => {
        if (mode === 'income') return entries.filter(e => e.amount > 0);
        if (mode === 'expenses') return entries.filter(e => e.amount < 0);
        return entries;
    };

    useEffect(() => {
        const modeFilteredBankEntries = filterEntriesByMode(bankEntries, filterMode);
        const modeFilteredZiherEntries = filterEntriesByMode(ziherEntries, filterMode);

        const searchedBankForUnmatched = searchFilterEntries(modeFilteredBankEntries, globalSearchQuery);
        const searchedZiherForUnmatched = searchFilterEntries(modeFilteredZiherEntries, globalSearchQuery);

        const unmatchedBank = searchedBankForUnmatched.filter(e => e.status === 'unmatched');
        const unmatchedZiher = searchedZiherForUnmatched.filter(e => e.status === 'unmatched');

        const combined = sortEntriesByDate([...unmatchedBank, ...unmatchedZiher]);
        setUnmatchedCombinedEntries(combined);
    }, [bankEntries, ziherEntries, filterMode, globalSearchQuery]);

    useEffect(() => {
        const modeFilteredBankEntries = filterEntriesByMode(bankEntries, filterMode);
        const modeFilteredZiherEntries = filterEntriesByMode(ziherEntries, filterMode);

        const newBankTotal = modeFilteredBankEntries.reduce((sum, entry) => sum + entry.amount, 0);
        const newZiherTotal = modeFilteredZiherEntries.reduce((sum, entry) => sum + entry.amount, 0);
        setBankTotal(newBankTotal);
        setZiherTotal(newZiherTotal);
        setDifference(newBankTotal - newZiherTotal);
    }, [bankEntries, ziherEntries, filterMode]);

    const handleFilesProcessed = async (bankFile: File, ziherFile: File) => {
        setIsProcessing(true);
        setProgress(0);

        let newBankEntries: TransactionEntry[] = [];
        let newZiherEntries: TransactionEntry[] = [];
        let successfullyParsedBank = false;
        let successfullyParsedZiher = false;

        try {
            const bankCsvText = await bankFile.text();
            await updateProgress(10);
            newBankEntries = parseCsv(bankCsvText, 'bank');
            successfullyParsedBank = newBankEntries.length > 0;
            if (!successfullyParsedBank) {
                toast({
                    title: "Problem z plikiem historii z banku",
                    description: `Nie znaleziono wpisów w "${bankFile.name}". Sprawdź format/zawartość pliku.`,
                    variant: "destructive",
                });
            }
            await updateProgress(20);

            const ziherCsvText = await ziherFile.text();
            await updateProgress(30);
            newZiherEntries = parseCsv(ziherCsvText, 'ziher');
            successfullyParsedZiher = newZiherEntries.length > 0;
            if (!successfullyParsedZiher) {
                toast({
                    title: "Problem z plikiem Ziher",
                    description: `Nie znaleziono wpisów w "${ziherFile.name}". Sprawdź format/zawartość pliku.`,
                    variant: "destructive",
                });
            }
            await updateProgress(40);

            setSelectedBankEntryIds([]);
            setSelectedZiherEntryIds([]);
            setMatchGroups([]);
            setFilterMode('all');
            setGlobalSearchQuery('');

            const sortedNewBankEntries = sortEntriesByDate(newBankEntries);
            const sortedNewZiherEntries = sortEntriesByDate(newZiherEntries);

            setBankEntries(sortedNewBankEntries);
            setZiherEntries(sortedNewZiherEntries);

            let autoMatchedCount = 0;
            if (sortedNewBankEntries.length > 0 && sortedNewZiherEntries.length > 0) {
                await updateProgress(60);
                const {
                    updatedBankEntries: autoMatchedBank,
                    updatedZiherEntries: autoMatchedZiher,
                    newMatches: autoNewMatches
                } = autoMatchEntries(sortedNewBankEntries, sortedNewZiherEntries);

                setBankEntries(sortEntriesByDate(autoMatchedBank));
                setZiherEntries(sortEntriesByDate(autoMatchedZiher));
                setMatchGroups(autoNewMatches);
                autoMatchedCount = autoNewMatches.length;
                await updateProgress(80);
            }

            if (successfullyParsedBank || successfullyParsedZiher) {
                let description = "Pliki CSV zostały sparsowane.";
                if (newBankEntries.length > 0 && newZiherEntries.length > 0) {
                    description += ` Automatycznie dopasowano ${autoMatchedCount} wpisów.`;
                }
                toast({ title: "Pliki przetworzone", description });
            }

        } catch (error: any) {
            toast({
                title: "Błąd przetwarzania plików",
                description: error.message || "Nie można sparsować plików CSV.",
                variant: "destructive",
            });
            setBankEntries(prev => successfullyParsedBank ? sortEntriesByDate(newBankEntries) : (newBankEntries.length === 0 && prev.length > 0 && !error.message.toLowerCase().includes('bank') ? prev : sortEntriesByDate(newBankEntries)));
            setZiherEntries(prev => successfullyParsedZiher ? sortEntriesByDate(newZiherEntries) : (newZiherEntries.length === 0 && prev.length > 0 && !error.message.toLowerCase().includes('ziher') ? prev : sortEntriesByDate(newZiherEntries)));

        } finally {
            await updateProgress(100);
            setTimeout(() => setIsProcessing(false), 500);
        }
    };

    const executeManualMatch = useCallback(async (
        bankIds: string[],
        ziherIds: string[],
        sumOfBankEntries: number,
        sumOfZiherEntries: number
    ) => {
        const { updatedBankEntries, updatedZiherEntries, newMatch } = manuallyMatchEntries(
            bankIds,
            ziherIds,
            bankEntries,
            ziherEntries,
            sumOfBankEntries,
            sumOfZiherEntries
        );

        setBankEntries(sortEntriesByDate(updatedBankEntries));
        setZiherEntries(sortEntriesByDate(updatedZiherEntries));

        if (newMatch) {
            setMatchGroups(prev => [...prev, newMatch]);
            toast({ title: "Ręczne dopasowanie zakończone sukcesem", description: "Wybrane wpisy zostały dopasowane." });
        } else {
            toast({
                title: "Ręczne dopasowanie nie powiodło się",
                description: "Nie można dopasować. Upewnij się, że wybrane wpisy pochodzą z różnych źródeł i wszystkie są 'niedopasowane'.",
                variant: "destructive"
            });
        }
        setSelectedBankEntryIds([]);
        setSelectedZiherEntryIds([]);

        await updateProgress(100);
        setTimeout(() => setIsProcessing(false), 500);

    }, [bankEntries, ziherEntries, toast, updateProgress]);

    const handleManualMatch = useCallback(async () => {
        setIsProcessing(true);
        setProgress(0);
        await updateProgress(30);

        const bankEntriesToMatch = bankEntries.filter(e => selectedBankEntryIds.includes(e.id) && e.status === 'unmatched');
        const ziherEntriesToMatch = ziherEntries.filter(e => selectedZiherEntryIds.includes(e.id) && e.status === 'unmatched');

        if (bankEntriesToMatch.length === 0 || ziherEntriesToMatch.length === 0) {
            toast({
                title: "Ręczne dopasowanie nie powiodło się",
                description: "Nie można dopasować. Upewnij się, że wybrane wpisy pochodzą z różnych źródeł (Bank i Ziher), nie są puste i wszystkie są 'niedopasowane'.",
                variant: "destructive"
            });
            await updateProgress(100);
            setTimeout(() => setIsProcessing(false), 500);
            return;
        }

        const sumSelectedBank = bankEntriesToMatch.reduce((acc, entry) => acc + entry.amount, 0);
        const sumSelectedZiher = ziherEntriesToMatch.reduce((acc, entry) => acc + entry.amount, 0);
        await updateProgress(70);

        if (sumSelectedBank.toFixed(2) !== sumSelectedZiher.toFixed(2)) {
            setMismatchConfirmData({
                bankIds: selectedBankEntryIds,
                ziherIds: selectedZiherEntryIds,
                bankSum: sumSelectedBank,
                ziherSum: sumSelectedZiher,
            });
            setIsMismatchConfirmDialogOpen(true);
        } else {
            await executeManualMatch(selectedBankEntryIds, selectedZiherEntryIds, sumSelectedBank, sumSelectedZiher);
        }
    }, [selectedBankEntryIds, selectedZiherEntryIds, bankEntries, ziherEntries, toast, executeManualMatch, updateProgress]);

    const handleUnmatch = useCallback(async () => {
        setIsProcessing(true);
        setProgress(0);
        await updateProgress(20);
        const matchIdsToUnmatch = new Set<string>();
        [...selectedBankEntryIds, ...selectedZiherEntryIds].forEach(id => {
            const bankEntry = bankEntries.find(e => e.id === id);
            if (bankEntry?.matchId) matchIdsToUnmatch.add(bankEntry.matchId);
            const ziherEntry = ziherEntries.find(e => e.id === id);
            if (ziherEntry?.matchId) matchIdsToUnmatch.add(ziherEntry.matchId);
        });

        if (matchIdsToUnmatch.size === 0) {
            toast({ title: "Nie wybrano dopasowania", description: "Proszę wybrać dopasowane wpisy, aby je rozłączyć.", variant: "destructive" });
            await updateProgress(100);
            setTimeout(() => setIsProcessing(false), 500);
            return;
        }

        let currentBankEntries = [...bankEntries];
        let currentZiherEntries = [...ziherEntries];
        let unmatchCount = 0;

        await updateProgress(40);
        matchIdsToUnmatch.forEach(matchId => {
            const result = unmatchEntriesByMatchId(matchId, currentBankEntries, currentZiherEntries);
            currentBankEntries = result.updatedBankEntries;
            currentZiherEntries = result.updatedZiherEntries;
            unmatchCount++;
        });
        await updateProgress(80);

        setBankEntries(sortEntriesByDate(currentBankEntries));
        setZiherEntries(sortEntriesByDate(currentZiherEntries));
        setMatchGroups(prev => prev.filter(mg => !matchIdsToUnmatch.has(mg.id)));
        setSelectedBankEntryIds([]);
        setSelectedZiherEntryIds([]);
        toast({ title: "Rozłączanie zakończone sukcesem", description: `Rozłączono ${unmatchCount} grup(ę/y).` });
        await updateProgress(100);
        setTimeout(() => setIsProcessing(false), 500);
    }, [selectedBankEntryIds, selectedZiherEntryIds, bankEntries, ziherEntries, toast, updateProgress]);

    const handleReset = useCallback(async () => {
        setIsProcessing(true);
        await updateProgress(50);
        setBankEntries([]);
        setZiherEntries([]);
        setSelectedBankEntryIds([]);
        setSelectedZiherEntryIds([]);
        setUnmatchedCombinedEntries([]);
        setMatchGroups([]);
        setFilterMode('all');
        setGlobalSearchQuery('');
        await updateProgress(100);
        setTimeout(() => setIsProcessing(false), 300);
        toast({ title: "Reset zakończony", description: "Wszystkie dane zostały wyczyszczone." });
    }, [toast, updateProgress]);

    const handleRowSelect = (source: 'bank' | 'ziher' | 'unmatched', id: string, isSelected: boolean) => {
        let entry: TransactionEntry | undefined;
        if (source === 'unmatched') {
            entry = unmatchedCombinedEntries.find(e => e.id === id);
        } else if (source === 'bank') {
            entry = displayedBankEntries.find(e => e.id === id);
        } else {
            entry = displayedZiherEntries.find(e => e.id === id);
        }

        if (!entry) return;

        const actualSource = entry.source;

        if (actualSource === 'bank') {
            setSelectedBankEntryIds(prev => {
                const newSet = new Set(prev);
                if (isSelected) {
                    newSet.add(id);
                } else {
                    newSet.delete(id);
                }
                return Array.from(newSet);
            });
        } else {
            setSelectedZiherEntryIds(prev => {
                const newSet = new Set(prev);
                if (isSelected) {
                    newSet.add(id);
                } else {
                    newSet.delete(id);
                }
                return Array.from(newSet);
            });
        }
    };

    const handleDeselectAll = useCallback(() => {
        setSelectedBankEntryIds([]);
        setSelectedZiherEntryIds([]);
    }, []);

    const showFileUpload = bankEntries.length === 0 && ziherEntries.length === 0;
    const showTransactionData = bankEntries.length > 0 || ziherEntries.length > 0;

    useEffect(() => {
        if (!isProcessing) {
            setProgress(0);
        }
    }, [isProcessing]);

    const displayedBankEntries = searchFilterEntries(filterEntriesByMode(bankEntries, filterMode), globalSearchQuery);
    const displayedZiherEntries = searchFilterEntries(filterEntriesByMode(ziherEntries, filterMode), globalSearchQuery);

    const selectableUnmatchedEntries = unmatchedCombinedEntries.filter(e => e.status !== 'matched');
    const isAllUnmatchedSelected = selectableUnmatchedEntries.length > 0 &&
        selectableUnmatchedEntries.every(e => (e.source === 'bank' ? selectedBankEntryIds : selectedZiherEntryIds).includes(e.id));

    const handleToggleSelectAllUnmatched = () => {
        const bankIdsToToggle = selectableUnmatchedEntries.filter(e => e.source === 'bank').map(e => e.id);
        const ziherIdsToToggle = selectableUnmatchedEntries.filter(e => e.source === 'ziher').map(e => e.id);

        if (isAllUnmatchedSelected) {
            setSelectedBankEntryIds(prev => prev.filter(id => !bankIdsToToggle.includes(id)));
            setSelectedZiherEntryIds(prev => prev.filter(id => !ziherIdsToToggle.includes(id)));
        } else {
            setSelectedBankEntryIds(prev => Array.from(new Set([...prev, ...bankIdsToToggle])));
            setSelectedZiherEntryIds(prev => Array.from(new Set([...prev, ...ziherIdsToToggle])));
        }
    };

    const isAllBankSelected = displayedBankEntries.length > 0 && displayedBankEntries.every(e => selectedBankEntryIds.includes(e.id));
    const handleToggleSelectAllBank = () => {
        const allDisplayedBankIds = displayedBankEntries.map(e => e.id);
        if (isAllBankSelected) {
            setSelectedBankEntryIds(prev => prev.filter(id => !allDisplayedBankIds.includes(id)));
        } else {
            setSelectedBankEntryIds(prev => Array.from(new Set([...prev, ...allDisplayedBankIds])));
        }
    };

    const isAllZiherSelected = displayedZiherEntries.length > 0 && displayedZiherEntries.every(e => selectedZiherEntryIds.includes(e.id));
    const handleToggleSelectAllZiher = () => {
        const allDisplayedZiherIds = displayedZiherEntries.map(e => e.id);
        if (isAllZiherSelected) {
            setSelectedZiherEntryIds(prev => prev.filter(id => !allDisplayedZiherIds.includes(id)));
        } else {
            setSelectedZiherEntryIds(prev => Array.from(new Set([...prev, ...allDisplayedZiherIds])));
        }
    };

    const allEntriesAreGloballyMatched = (bankEntries.length > 0 || ziherEntries.length > 0) &&
        bankEntries.every(e => e.status === 'matched') &&
        ziherEntries.every(e => e.status === 'matched');

    return {
        // State
        bankEntries,
        ziherEntries,
        selectedBankEntryIds,
        selectedZiherEntryIds,
        unmatchedCombinedEntries,
        matchGroups,
        isProcessing,
        progress,
        bankTotal,
        ziherTotal,
        difference,
        filterMode,
        globalSearchQuery,
        isMismatchConfirmDialogOpen,
        mismatchConfirmData,
        showFileUpload,
        showTransactionData,
        displayedBankEntries,
        displayedZiherEntries,
        selectableUnmatchedEntries,
        isAllUnmatchedSelected,
        isAllBankSelected,
        isAllZiherSelected,
        allEntriesAreGloballyMatched,

        // Handlers
        handleFilesProcessed,
        handleManualMatch,
        handleUnmatch,
        handleReset,
        handleRowSelect,
        handleDeselectAll,
        handleToggleSelectAllUnmatched,
        handleToggleSelectAllBank,
        handleToggleSelectAllZiher,
        setFilterMode,
        setGlobalSearchQuery,
        setIsMismatchConfirmDialogOpen,
        executeManualMatch,
        updateProgress,
        setIsProcessing
    };
}
