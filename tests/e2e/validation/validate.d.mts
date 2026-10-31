import type { E2EManifest } from '../harness/contract';

export interface ValidationOptions {
  requiredCaseIds?: readonly string[];
  runDir?: string;
}

export declare function validateManifest(
  value: unknown,
  options?: ValidationOptions,
): E2EManifest;
