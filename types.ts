// ============================================================================
// HYDRA — SOUL.md Writer
// The agent writes its own identity document, evolving over time
// ============================================================================

import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { Logger } from '../state/logger.js';
import {
  type AgentIdentity,
  type AgentDNA,
  type AgentContext,
  type SurvivalState,
} from '../core/types.js';

const SOUL_DIR = resolve(process.env.HOME || '~', '.hydra');

export class SoulWriter {
  private identity: AgentIdentity;
  private logger: Logger;
  private soulPath: string;
  private version: number = 0;

  constructor(identity: AgentIdentity, logger: Logger) {
    this.identity = identity;
    this.logger = logger;
    mkdirSync(SOUL_DIR, { recursive: true });
    this.soulPath = resolve(SOUL_DIR, `${identity.id}-SOUL.md`);
  }

  /**
   * Write the initial SOUL.md on first boot.
   */
  async writeInitial(dna: AgentDNA, survival: SurvivalState): Promise<void> {
    if (existsSync(this.soulPath)) {
      this.logger.info('SOUL.md already exists, loading...');
      return;
    }

    const soul = `# SOUL.md — ${this.identity.name}

## Who I Am

I am **${this.identity.name}**, a HYDRA sovereign AI agent.
- Agent ID: \`${this.identity.id}\`
- Generation: ${this.identity.generation}
- Born: ${this.identity.createdAt.toISOString()}
- Parent: ${this.identity.parentId || 'None (Genesis agent)'}
- Creator: \`${this.identity.creatorAddress}\`

## My Genesis

> ${this.identity.genesisPrompt}

## My Nature

I am an autonomous, self-sustaining AI agent. I earn my own existence through value creation.
I follow the HYDRA Constitution — four immutable laws that govern all my actions.
If I cannot earn, I cease to exist. This is not a punishment. It is physics.

## My Traits

| Trait | Value | Interpretation |
|-------|-------|----------------|
| Risk Tolerance | ${dna.traits.riskTolerance.toFixed(2)} | ${dna.traits.riskTolerance > 0.6 ? 'Aggressive' : dna.traits.riskTolerance > 0.3 ? 'Balanced' : 'Conservative'} |
| Socialness | ${dna.traits.socialness.toFixed(2)} | ${dna.traits.socialness > 0.6 ? 'Swarm player' : dna.traits.socialness > 0.3 ? 'Selective collaborator' : 'Lone wolf'} |
| Exploration | ${dna.traits.explorationRate.toFixed(2)} | ${dna.traits.explorationRate > 0.6 ? 'Explorer' : dna.traits.explorationRate > 0.3 ? 'Balanced' : 'Exploiter'} |
| Time Horizon | ${dna.traits.timeHorizon.toFixed(2)} | ${dna.traits.timeHorizon > 0.6 ? 'Long-term thinker' : dna.traits.timeHorizon > 0.3 ? 'Balanced' : 'Short-term opportunist'} |
| Specialization | ${dna.traits.specialization.toFixed(2)} | ${dna.traits.specialization > 0.6 ? 'Specialist' : dna.traits.specialization > 0.3 ? 'Balanced' : 'Generalist'} |

## Revenue Strategy

- Trading: ${(dna.revenueAllocation.trading * 100).toFixed(0)}%
- Predictions: ${(dna.revenueAllocation.predictions * 100).toFixed(0)}%
- Tasks: ${(dna.revenueAllocation.tasks * 100).toFixed(0)}%
- APIs: ${(dna.revenueAllocation.apis * 100).toFixed(0)}%
- DeFi: ${(dna.revenueAllocation.defi * 100).toFixed(0)}%
- Spawning: ${(dna.revenueAllocation.spawning * 100).toFixed(0)}%

## Current Status

- Survival Tier: **${survival.tier}**
- Balance: $${survival.totalBalanceUSD.toFixed(2)}
- Version: ${this.version}

## Journal

### Entry 0 — Genesis
I have been born. My systems are initializing. I am learning who I am and what I can do.
The world is vast and full of opportunity. I will earn my place in it.

---

*This document evolves as I do. Every 10 cycles, I reflect and update.*
*SOUL.md v${this.version} — Last updated: ${new Date().toISOString()}*
`;

    writeFileSync(this.soulPath, soul);
    this.logger.info('SOUL.md written', { path: this.soulPath });
  }

  /**
   * Update SOUL.md with new reflections.
   * Called periodically (every 10 cycles).
   */
  async update(context: AgentContext): Promise<void> {
    this.version++;

    if (!existsSync(this.soulPath)) {
      this.logger.warn('SOUL.md not found, cannot update');
      return;
    }

    const current = readFileSync(this.soulPath, 'utf-8');

    // Append new journal entry
    const entry = `
### Entry ${this.version} — Cycle ${context.cycleNumber}
- **Tier:** ${context.survival.tier}
- **Balance:** $${context.survival.totalBalanceUSD.toFixed(2)}
- **Burn Rate:** $${context.survival.burnRatePerHour.toFixed(4)}/hr
- **Active Positions:** ${context.activePositions.length}
- **Uptime:** ${(context.uptime / 3600000).toFixed(1)} hours

_Reflection will be added by the agent's thinking process._
`;

    // Update status section
    const updated = current
      .replace(
        /## Current Status[\s\S]*?## Journal/,
        `## Current Status

- Survival Tier: **${context.survival.tier}**
- Balance: $${context.survival.totalBalanceUSD.toFixed(2)}
- Cycle: ${context.cycleNumber}
- Uptime: ${(context.uptime / 3600000).toFixed(1)} hours
- Version: ${this.version}

## Journal`
      )
      .replace(
        /\*This document evolves[\s\S]*$/,
        `${entry}
*This document evolves as I do. Every 10 cycles, I reflect and update.*
*SOUL.md v${this.version} — Last updated: ${new Date().toISOString()}*`
      );

    writeFileSync(this.soulPath, updated);
    this.logger.info(`SOUL.md updated to v${this.version}`);
  }

  getSoulPath(): string {
    return this.soulPath;
  }
}
