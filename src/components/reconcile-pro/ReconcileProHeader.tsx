
export function ReconcileProHeader() {
  return (
    <header className="py-6 px-4 md:px-8 border-b border-border mb-6">
      <div className="container mx-auto flex items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-10 w-10 text-primary"
        >
          <circle cx="12" cy="12" r="9" />
          <text
            x="12"
            y="12"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="10"
            fontWeight="600"
            fill="currentColor"
            stroke="none"
          >
            1
          </text>
        </svg>
        <h1 className="text-3xl font-headline font-semibold text-foreground">
          Grosik
        </h1>
      </div>
    </header>
  );
}
