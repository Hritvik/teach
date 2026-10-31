import type { SecurityLedger } from './security/index.ts';
export interface DevelopmentEnv {
  readonly LEARNING_DB: D1Database;
  readonly SECURITY_LEDGER: DurableObjectNamespace<SecurityLedger>;
  readonly TEACH_DEV_TOKEN: string;
  readonly TEACH_DEV_LEARNER: string;
  readonly TEACH_DEV_GRANT: string;
}
