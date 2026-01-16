import { Logger } from '@nestjs/common';

/**
 * Progress Utility
 *
 * Provides consistent progress indicators for migrations and seeding operations.
 * Designed for readability in both local development and Docker environments.
 *
 * Features:
 * - Step-based progress tracking (e.g., [2/5])
 * - Spinner-style indicators for ongoing operations
 * - Consistent formatting across all database operations
 * - Color-coded status indicators (using Unicode symbols for compatibility)
 */

/**
 * Progress step status
 */
export enum ProgressStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

/**
 * Progress step interface
 */
export interface ProgressStep {
  name: string;
  description: string;
  status: ProgressStatus;
  duration?: number;
  result?: string;
}

/**
 * Status icons (Unicode-compatible for terminal/Docker)
 */
const STATUS_ICONS = {
  [ProgressStatus.PENDING]: '○',
  [ProgressStatus.IN_PROGRESS]: '⏳',
  [ProgressStatus.COMPLETED]: '✓',
  [ProgressStatus.SKIPPED]: '⊘',
  [ProgressStatus.FAILED]: '✗',
};

/**
 * Progress tracker for multi-step operations
 */
export class ProgressTracker {
  private readonly logger: Logger;
  private steps: ProgressStep[] = [];
  private currentStepIndex = -1;
  private startTime: number;
  private readonly context: string;

  constructor(context: string) {
    this.context = context;
    this.logger = new Logger(context);
    this.startTime = Date.now();
  }

  /**
   * Initialize progress tracker with steps
   */
  init(steps: Array<{ name: string; description: string }>): void {
    this.steps = steps.map(step => ({
      ...step,
      status: ProgressStatus.PENDING,
    }));
    this.startTime = Date.now();
    this.printHeader();
  }

  /**
   * Print the operation header
   */
  private printHeader(): void {
    this.logger.log('');
    this.logger.log('╔══════════════════════════════════════════════════════════════╗');
    this.logger.log(`║  ${this.context.toUpperCase().padEnd(58)}║`);
    this.logger.log('╚══════════════════════════════════════════════════════════════╝');
    this.logger.log('');
  }

  /**
   * Start the next step
   */
  startStep(stepName: string): void {
    const stepIndex = this.steps.findIndex(s => s.name === stepName);
    if (stepIndex === -1) {
      this.logger.warn(`Step not found: ${stepName}`);
      return;
    }

    this.currentStepIndex = stepIndex;
    this.steps[stepIndex].status = ProgressStatus.IN_PROGRESS;

    const progress = `[${stepIndex + 1}/${this.steps.length}]`;
    const step = this.steps[stepIndex];
    this.logger.log(`${progress} ${STATUS_ICONS[ProgressStatus.IN_PROGRESS]} ${step.description}...`);
  }

  /**
   * Complete the current step
   */
  completeStep(result?: string, skipped = false): void {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.steps.length) {
      return;
    }

    const step = this.steps[this.currentStepIndex];
    step.status = skipped ? ProgressStatus.SKIPPED : ProgressStatus.COMPLETED;
    step.duration = Date.now() - this.startTime;
    step.result = result;

    const icon = STATUS_ICONS[step.status];
    const statusText = skipped ? 'Skipped (already exists)' : 'Done';
    const resultText = result ? ` - ${result}` : '';
    this.logger.log(`     ${icon} ${statusText}${resultText}`);
  }

  /**
   * Fail the current step
   */
  failStep(error: string): void {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.steps.length) {
      return;
    }

    const step = this.steps[this.currentStepIndex];
    step.status = ProgressStatus.FAILED;
    step.result = error;

    this.logger.error(`     ${STATUS_ICONS[ProgressStatus.FAILED]} Failed: ${error}`);
  }

  /**
   * Print final summary
   */
  printSummary(additionalInfo?: Record<string, string | number>): void {
    const totalDuration = Date.now() - this.startTime;
    const completedCount = this.steps.filter(s => s.status === ProgressStatus.COMPLETED).length;
    const skippedCount = this.steps.filter(s => s.status === ProgressStatus.SKIPPED).length;
    const failedCount = this.steps.filter(s => s.status === ProgressStatus.FAILED).length;

    this.logger.log('');
    this.logger.log('┌──────────────────────────────────────────────────────────────┐');
    this.logger.log(`│  Summary                                                     │`);
    this.logger.log('├──────────────────────────────────────────────────────────────┤');
    this.logger.log(`│  Steps completed: ${String(completedCount).padEnd(42)}│`);
    if (skippedCount > 0) {
      this.logger.log(`│  Steps skipped:   ${String(skippedCount).padEnd(42)}│`);
    }
    if (failedCount > 0) {
      this.logger.log(`│  Steps failed:    ${String(failedCount).padEnd(42)}│`);
    }

    if (additionalInfo) {
      for (const [key, value] of Object.entries(additionalInfo)) {
        this.logger.log(`│  ${key}: ${String(value).padEnd(60 - key.length - 2)}│`);
      }
    }

    this.logger.log(`│  Duration:        ${String(totalDuration + 'ms').padEnd(42)}│`);
    this.logger.log('└──────────────────────────────────────────────────────────────┘');
    this.logger.log('');
  }

  /**
   * Get current progress as a formatted string
   */
  getProgressString(): string {
    const completed = this.steps.filter(
      s => s.status === ProgressStatus.COMPLETED || s.status === ProgressStatus.SKIPPED,
    ).length;
    return `[${completed}/${this.steps.length}]`;
  }

  /**
   * Check if all steps completed successfully
   */
  isSuccess(): boolean {
    return this.steps.every(
      s => s.status === ProgressStatus.COMPLETED || s.status === ProgressStatus.SKIPPED,
    );
  }

  /**
   * Get the total duration
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Simple progress indicator for single operations
 */
export class SimpleProgress {
  private readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  /**
   * Log operation start
   */
  start(message: string): void {
    this.logger.log(`${STATUS_ICONS[ProgressStatus.IN_PROGRESS]} ${message}...`);
  }

  /**
   * Log operation completion
   */
  complete(message: string, result?: string): void {
    const resultText = result ? ` (${result})` : '';
    this.logger.log(`${STATUS_ICONS[ProgressStatus.COMPLETED]} ${message}${resultText}`);
  }

  /**
   * Log operation skipped
   */
  skip(message: string, reason?: string): void {
    const reasonText = reason ? ` - ${reason}` : '';
    this.logger.log(`${STATUS_ICONS[ProgressStatus.SKIPPED]} ${message}${reasonText}`);
  }

  /**
   * Log operation failure
   */
  fail(message: string, error?: string): void {
    const errorText = error ? `: ${error}` : '';
    this.logger.error(`${STATUS_ICONS[ProgressStatus.FAILED]} ${message}${errorText}`);
  }
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Create a simple progress bar string
 */
export function createProgressBar(current: number, total: number, width = 20): string {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
}
