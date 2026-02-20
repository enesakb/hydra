// ============================================================================
// HYDRA — SQLite Database / State Persistence
// ============================================================================

import { mkdirSync } from 'fs';
import { resolve } from 'path';
import type { ChainWallet, SurvivalTier } from '../core/types.js';

interface CycleLog {
  cycleNumber: number;
  actions: string[];
  revenue: number;
  costs: number;
  tier: SurvivalTier;
  timestamp: Date;
}

export class Database {
  private agentId: string;
  private dbPath: string;
  private db: any = null;

  constructor(agentId: string, dataDir: string) {
    this.agentId = agentId;
    const dir = resolve(dataDir, agentId);
    mkdirSync(dir, { recursive: true });
    this.dbPath = resolve(dir, 'hydra.db');
  }

  async initialize(): Promise<void> {
    try {
      const BetterSqlite3 = (await import('better-sqlite3')).default;
      this.db = new BetterSqlite3(this.dbPath);
      this.createTables();
    } catch {
      // Fallback: in-memory store
      console.warn('SQLite unavailable, using in-memory store');
      this.db = new InMemoryStore();
    }
  }

  private createTables(): void {
    if (!this.db || this.db instanceof InMemoryStore) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        chain TEXT PRIMARY KEY,
        address TEXT NOT NULL,
        private_key TEXT NOT NULL,
        balance TEXT DEFAULT '0'
      );

      CREATE TABLE IF NOT EXISTS cycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cycle_number INTEGER NOT NULL,
        actions TEXT NOT NULL,
        revenue REAL NOT NULL,
        costs REAL NOT NULL,
        tier TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        engine TEXT NOT NULL,
        exchange TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        size REAL NOT NULL,
        entry_price REAL NOT NULL,
        current_price REAL NOT NULL,
        unrealized_pnl REAL NOT NULL,
        stop_loss REAL,
        take_profit REAL,
        opened_at TEXT NOT NULL,
        closed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS reputation (
        agent_id TEXT PRIMARY KEY,
        trading_score REAL DEFAULT 0,
        task_completion_score REAL DEFAULT 0,
        reliability_score REAL DEFAULT 0,
        cooperation_score REAL DEFAULT 0,
        innovation_score REAL DEFAULT 0,
        total_earned REAL DEFAULT 0,
        total_paid REAL DEFAULT 0,
        agents_spawned INTEGER DEFAULT 0,
        tasks_completed INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS modifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        diff TEXT NOT NULL,
        constitution_check INTEGER NOT NULL,
        sandbox_passed INTEGER NOT NULL,
        status TEXT NOT NULL,
        applied_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dna_archive (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        generation INTEGER NOT NULL,
        dna TEXT NOT NULL,
        fitness REAL,
        cause_of_death TEXT,
        archived_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        read INTEGER DEFAULT 0,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cycles_number ON cycles(cycle_number);
      CREATE INDEX IF NOT EXISTS idx_positions_engine ON positions(engine);
      CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent, read);
    `);
  }

  // ─── Wallet Operations ───────────────────────────────────────────────────

  async saveWallet(wallet: ChainWallet): Promise<void> {
    if (this.db instanceof InMemoryStore) {
      this.db.set(`wallet:${wallet.chain}`, wallet);
      return;
    }

    this.db.prepare(`
      INSERT OR REPLACE INTO wallets (chain, address, private_key, balance)
      VALUES (?, ?, ?, ?)
    `).run(wallet.chain, wallet.address, wallet.privateKey, wallet.balance.toString());
  }

  async getWallets(): Promise<ChainWallet[]> {
    if (this.db instanceof InMemoryStore) {
      return this.db.getAll('wallet:') as ChainWallet[];
    }

    const rows = this.db.prepare('SELECT * FROM wallets').all();
    return rows.map((r: any) => ({
      chain: r.chain,
      address: r.address,
      privateKey: r.private_key,
      balance: BigInt(r.balance),
    }));
  }

  // ─── Cycle Logging ───────────────────────────────────────────────────────

  async logCycle(cycle: CycleLog): Promise<void> {
    if (this.db instanceof InMemoryStore) {
      this.db.set(`cycle:${cycle.cycleNumber}`, cycle);
      return;
    }

    this.db.prepare(`
      INSERT INTO cycles (cycle_number, actions, revenue, costs, tier, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      cycle.cycleNumber,
      JSON.stringify(cycle.actions),
      cycle.revenue,
      cycle.costs,
      cycle.tier,
      cycle.timestamp.toISOString(),
    );
  }

  // ─── DNA Archive ─────────────────────────────────────────────────────────

  async archiveDNA(agentId: string, generation: number, dna: any, fitness: number, causeOfDeath: string): Promise<void> {
    if (this.db instanceof InMemoryStore) {
      this.db.set(`dna:${agentId}`, { agentId, generation, dna, fitness, causeOfDeath });
      return;
    }

    this.db.prepare(`
      INSERT INTO dna_archive (agent_id, generation, dna, fitness, cause_of_death, archived_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(agentId, generation, JSON.stringify(dna), fitness, causeOfDeath, new Date().toISOString());
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.db && !(this.db instanceof InMemoryStore)) {
      this.db.close();
    }
  }
}

// ─── In-Memory Fallback ────────────────────────────────────────────────────

class InMemoryStore {
  private data: Map<string, any> = new Map();

  set(key: string, value: any): void {
    this.data.set(key, value);
  }

  get(key: string): any {
    return this.data.get(key);
  }

  getAll(prefix: string): any[] {
    const results: any[] = [];
    for (const [key, value] of this.data) {
      if (key.startsWith(prefix)) results.push(value);
    }
    return results;
  }
}
