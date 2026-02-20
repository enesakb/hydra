// ============================================================================
// HYDRA — Logging & Audit System
// ============================================================================

import { mkdirSync, appendFileSync } from 'fs';
import { resolve } from 'path';
import { LogLevel, type AuditLogEntry } from '../core/types.js';

const LOG_DIR = resolve(process.env.HOME || '~', '.hydra', 'logs');
const AUDIT_DIR = resolve(process.env.HOME || '~', '.hydra', 'audit');

export class Logger {
  private agentId: string;
  private logFile: string;
  private auditFile: string;
  private minLevel: LogLevel;

  constructor(agentId: string, minLevel: LogLevel = LogLevel.INFO) {
    this.agentId = agentId;
    this.minLevel = minLevel;

    mkdirSync(LOG_DIR, { recursive: true });
    mkdirSync(AUDIT_DIR, { recursive: true });

    const date = new Date().toISOString().split('T')[0];
    this.logFile = resolve(LOG_DIR, `${agentId}-${date}.log`);
    this.auditFile = resolve(AUDIT_DIR, `${agentId}-audit.jsonl`);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase().padEnd(8)}] [${this.agentId}]`;
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `${prefix} ${message}${dataStr}`;
  }

  private write(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, data);

    // Console output with colors
    const colors: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: '\x1b[90m',    // Gray
      [LogLevel.INFO]: '\x1b[36m',     // Cyan
      [LogLevel.WARN]: '\x1b[33m',     // Yellow
      [LogLevel.ERROR]: '\x1b[31m',    // Red
      [LogLevel.CRITICAL]: '\x1b[35m', // Magenta
    };
    console.log(`${colors[level]}${formatted}\x1b[0m`);

    // File output
    try {
      appendFileSync(this.logFile, formatted + '\n');
    } catch {
      // Silent fail for log writes
    }
  }

  debug(message: string, data?: unknown): void {
    this.write(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.write(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.write(LogLevel.WARN, message, data);
  }

  error(message: string, data?: unknown): void {
    this.write(LogLevel.ERROR, message, data);
  }

  critical(message: string, data?: unknown): void {
    this.write(LogLevel.CRITICAL, `🚨 ${message}`, data);
  }

  /**
   * Write an audit log entry — immutable record of agent actions.
   */
  audit(entry: Omit<AuditLogEntry, 'timestamp' | 'agentId'>): void {
    const fullEntry: AuditLogEntry = {
      timestamp: new Date(),
      agentId: this.agentId,
      ...entry,
    };

    try {
      appendFileSync(this.auditFile, JSON.stringify(fullEntry) + '\n');
    } catch (error) {
      this.error('Failed to write audit log', { error });
    }

    // Also log to console for critical actions
    if (!entry.approved) {
      this.critical(`AUDIT: Action REJECTED — ${entry.action}`, {
        law: entry.constitutionLaw,
        details: entry.details,
      });
    } else {
      this.debug(`AUDIT: ${entry.action}`, entry.details);
    }
  }

  /**
   * Log agent cycle information
   */
  cycle(cycleNumber: number, phase: string, details?: unknown): void {
    this.info(`[Cycle ${cycleNumber}] ${phase}`, details);
  }

  /**
   * Log revenue information
   */
  revenue(engine: string, amount: number, details?: unknown): void {
    const emoji = amount >= 0 ? '💰' : '💸';
    this.info(`${emoji} [${engine}] ${amount >= 0 ? '+' : ''}$${amount.toFixed(4)}`, details);
  }

  /**
   * Log survival tier changes
   */
  tierChange(oldTier: string, newTier: string, balance: number): void {
    this.warn(`⚡ Tier change: ${oldTier} → ${newTier} (Balance: $${balance.toFixed(2)})`);
  }
}
