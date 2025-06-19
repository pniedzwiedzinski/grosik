"use client";

import { ReconcileProHeader } from '@/components/reconcile-pro/ReconcileProHeader';
import { FileUploadView } from '@/components/reconcile-pro/FileUploadView';
import { ProcessingProgress } from '@/components/reconcile-pro/ProcessingProgress';
import { ActionToolbar } from '@/components/reconcile-pro/ActionToolbar';
import { BalanceSummary } from '@/components/reconcile-pro/BalanceSummary';
import { TransactionTable } from '@/components/reconcile-pro/TransactionTable';
import { TransactionFilter } from '@/components/reconcile-pro/TransactionFilter';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from '@/lib/formatUtils';
import useReconciliation from '@/hooks/useReconciliation';

export default function ReconcileProPage() {
  const {
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
  } = useReconciliation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <ReconcileProHeader />
      <main className="flex-grow container mx-auto px-4 md:px-8 pb-8">
        {showFileUpload && (
          <FileUploadView onFilesProcessed={handleFilesProcessed} />
        )}

        {isProcessing && (
          <ProcessingProgress progress={progress} />
        )}

        {showTransactionData && !isProcessing && (
          <>
            <BalanceSummary
              bankTotal={bankTotal}
              ziherTotal={ziherTotal}
              difference={difference}
              onReset={handleReset}
              isProcessing={isProcessing}
            />
            <TransactionFilter
              currentFilterMode={filterMode}
              onFilterChange={setFilterMode}
            />
            <ActionToolbar
              onManualMatch={handleManualMatch}
              onUnmatch={handleUnmatch}
              selectedBankEntryIds={selectedBankEntryIds}
              selectedZiherEntryIds={selectedZiherEntryIds}
              bankEntries={bankEntries}
              ziherEntries={ziherEntries}
              isProcessing={isProcessing}
              onDeselectAll={handleDeselectAll}
            />
          </>
        )}

        {showTransactionData && !isProcessing && (
          <Tabs defaultValue="unmatched" className="mt-6 w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="unmatched">Niedopasowane</TabsTrigger>
              <TabsTrigger value="bank">Bank</TabsTrigger>
              <TabsTrigger value="ziher">Ziher</TabsTrigger>
            </TabsList>
            <TabsContent value="unmatched" className="mt-4 space-y-4">
              <TransactionTable
                title="Niedopasowane Wpisy"
                entries={unmatchedCombinedEntries}
                selectedIds={[...selectedBankEntryIds, ...selectedZiherEntryIds]}
                onRowSelect={(id, isSelected) => handleRowSelect('unmatched', id, isSelected)}
                isProcessing={isProcessing}
                matchGroups={matchGroups}
                isAllSelected={isAllUnmatchedSelected}
                onToggleSelectAll={handleToggleSelectAllUnmatched}
                canSelectAny={selectableUnmatchedEntries.length > 0}
                isGloballyReconciled={allEntriesAreGloballyMatched}
                searchQuery={globalSearchQuery}
                onSearchQueryChange={setGlobalSearchQuery}
                searchPlaceholder="Szukaj..."
              />
            </TabsContent>
            <TabsContent value="bank" className="mt-4 space-y-4">
              <TransactionTable
                title="Wpisy Bankowe"
                entries={displayedBankEntries}
                selectedIds={selectedBankEntryIds}
                onRowSelect={(id, isSelected) => handleRowSelect('bank', id, isSelected)}
                isProcessing={isProcessing}
                matchGroups={matchGroups}
                isAllSelected={isAllBankSelected}
                onToggleSelectAll={handleToggleSelectAllBank}
                canSelectAny={displayedBankEntries.length > 0}
                isGloballyReconciled={allEntriesAreGloballyMatched && displayedBankEntries.length === 0}
                searchQuery={globalSearchQuery}
                onSearchQueryChange={setGlobalSearchQuery}
                searchPlaceholder="Szukaj..."
              />
            </TabsContent>
            <TabsContent value="ziher" className="mt-4 space-y-4">
              <TransactionTable
                title="Wpisy Ziher"
                entries={displayedZiherEntries}
                selectedIds={selectedZiherEntryIds}
                onRowSelect={(id, isSelected) => handleRowSelect('ziher', id, isSelected)}
                isProcessing={isProcessing}
                matchGroups={matchGroups}
                isAllSelected={isAllZiherSelected}
                onToggleSelectAll={handleToggleSelectAllZiher}
                canSelectAny={displayedZiherEntries.length > 0}
                isGloballyReconciled={allEntriesAreGloballyMatched && displayedZiherEntries.length === 0}
                searchQuery={globalSearchQuery}
                onSearchQueryChange={setGlobalSearchQuery}
                searchPlaceholder="Szukaj..."
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <AlertDialog open={isMismatchConfirmDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsMismatchConfirmDialogOpen(false);
          if (isProcessing) {
            setTimeout(() => setIsProcessing(false), 300);
          }
        } else {
          setIsMismatchConfirmDialogOpen(true);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Niezgodne sumy</AlertDialogTitle>
            <AlertDialogDescription>
              Suma wybranych wpisów bankowych ({formatCurrency(mismatchConfirmData?.bankSum || 0)})
              różni się od sumy wybranych wpisów Ziher ({formatCurrency(mismatchConfirmData?.ziherSum || 0)}).
              <br />
              Czy na pewno chcesz je dopasować?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              if (isProcessing) {
                updateProgress(100).then(() => setTimeout(() => setIsProcessing(false), 300));
              }
            }}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (mismatchConfirmData) {
                await updateProgress(85);
                await executeManualMatch(
                  mismatchConfirmData.bankIds,
                  mismatchConfirmData.ziherIds,
                  mismatchConfirmData.bankSum,
                  mismatchConfirmData.ziherSum
                );
              }
            }}>Dopasuj mimo to</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
