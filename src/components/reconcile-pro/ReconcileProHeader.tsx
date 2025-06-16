
export function ReconcileProHeader() {
  return (
    <header className="py-6 px-4 md:px-8 border-b border-border mb-6">
      <div className="container mx-auto flex items-center gap-3">
        <img
          src="/icon-512x512.png"
          alt="Grosik Icon"
          className="h-9 w-9 rounded-full"
        >
          </img>
        <h1 className="text-3xl font-headline font-semibold text-foreground">
          Grosik
        </h1>
      </div>
    </header>
  );
}
