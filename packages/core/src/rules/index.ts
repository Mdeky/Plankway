import { reefsRule } from './reefs.ts';
import type { RuleModule } from './types.ts';

export interface RuleOptions {
  /** Reef twist, on by default. */
  reefs?: boolean;
}

export function createRules(options: RuleOptions = {}): RuleModule[] {
  const rules: RuleModule[] = [];
  if (options.reefs !== false) rules.push(reefsRule);
  return rules;
}

export const DEFAULT_RULES: readonly RuleModule[] = createRules();

export { reefsRule, REEFS_RULE_ID } from './reefs.ts';
export * from './types.ts';
