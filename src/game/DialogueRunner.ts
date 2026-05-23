export type DialogueCompleteHandler = () => void;

export class DialogueRunner {
  private queue: string[] = [];
  private onComplete?: DialogueCompleteHandler;

  start(lines: string[], onComplete?: DialogueCompleteHandler): string {
    this.queue = [...lines];
    this.onComplete = onComplete;
    return this.queue.shift() ?? "";
  }

  advance(): string | undefined {
    const next = this.queue.shift();

    if (next) {
      return next;
    }

    const onComplete = this.onComplete;
    this.onComplete = undefined;
    onComplete?.();
    return undefined;
  }

  clear(): void {
    this.queue = [];
    this.onComplete = undefined;
  }
}

