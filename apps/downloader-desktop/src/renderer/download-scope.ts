export type DownloadRequestMode = "all" | "selected";

export interface DownloadScopeResult {
  selectedChapterUrls: string[];
  fallbackToAll: boolean;
  errorMessage?: string;
}

export function resolveDownloadScope(
  mode: DownloadRequestMode,
  selectedChapterUrls: string[]
): DownloadScopeResult {
  if (mode === "all") {
    return {
      selectedChapterUrls: [],
      fallbackToAll: false
    };
  }

  if (selectedChapterUrls.length === 0) {
    return {
      selectedChapterUrls: [],
      fallbackToAll: false,
      errorMessage: "Select at least one chapter before downloading selected chapters."
    };
  }

  return {
    selectedChapterUrls,
    fallbackToAll: false
  };
}
