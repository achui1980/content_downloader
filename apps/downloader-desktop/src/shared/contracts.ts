export type TaskStatus = "idle" | "running" | "done" | "failed";

export interface TaskState {
  status: TaskStatus;
}

export interface StartInput {
  url: string;
  outputDir: string;
  concurrency: number;
  retries: number;
}

export interface StartInputValidationResult {
  ok: boolean;
  errors: string[];
}

export function buildDefaultStartInput(): StartInput {
  return {
    url: "https://www.2025copy.com/comic/guichuyinxiong",
    outputDir: "/tmp/2025copy-test",
    concurrency: 2,
    retries: 1
  };
}

export function buildInitialTaskState(): TaskState {
  return { status: "idle" };
}
