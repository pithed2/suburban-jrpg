export type DialogueCompleteHandler = () => void;
export interface DialogueLine {
  speaker: string;
  text: string;
}

export type DialogueInput = string | DialogueLine;

export class DialogueRunner {
  private queue: DialogueLine[] = [];
  private onComplete?: DialogueCompleteHandler;

  start(lines: DialogueInput[], onComplete?: DialogueCompleteHandler): DialogueLine {
    this.queue = lines.map(normalizeDialogueLine);
    this.onComplete = onComplete;
    return this.queue.shift() ?? { speaker: "DAD", text: "" };
  }

  advance(): DialogueLine | undefined {
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

function normalizeDialogueLine(line: DialogueInput): DialogueLine {
  return typeof line === "string"
    ? { speaker: "DAD", text: line }
    : line;
}
