export type Level = 1 | 2 | 3 | 4;
export type Confidence = 'sure' | 'think' | 'guess' | 'unknown';
export type ContentGrade = 'correct' | 'partial' | 'wrong' | 'na';
export type MasteryState = 'Unknown' | 'Exposed' | 'Shaky' | 'Solid' | 'Secure';
export type EvidenceStrength = 'strong' | 'practice' | 'miss' | 'unresolved' | 'exposure';
export type EvidenceKind = 'answer' | 'prediction' | 'teachback' | 'inquiry' | 'exposure' | 'self_rating' | 'observed' | 'inferred';
export interface Evidence {
  readonly id: string;
  readonly seq: number;
  readonly conceptId: string;
  readonly level: Level;
  readonly kind: EvidenceKind;
  readonly contentGrade: ContentGrade;
  readonly confidence: Confidence;
  readonly occurredAt: string;
  readonly acceptedAt?: string;
  readonly localDay: string;
  readonly contentHint?: boolean;
  readonly answerRevealed?: boolean;
  readonly assessmentForm?: 'production' | 'recognition';
  readonly schedulingEligible?: boolean;
  readonly rulesVersion?: number;
}
export interface Correction {
  readonly rootRecordId: string;
  readonly expectedEffectiveRevision: number;
  readonly effectiveRevision: number;
  readonly action: 'amend' | 'retract' | 'dispute' | 'resolve';
  readonly replacement?: Partial<Evidence>;
  readonly seq: number;
}
export interface MasteryOptions {
  readonly conceptId?: string;
  readonly level?: Level;
  readonly stale?: boolean;
  readonly now?: string;
  readonly dueAt?: string;
  readonly lastIntervalDays?: number;
}
export interface MasteryProjection {
  readonly state: MasteryState;
  readonly strongDays: readonly string[];
  readonly provisional: boolean;
  readonly stale: boolean;
  readonly fading: boolean;
  readonly asOfSeq: number;
}
export interface Concept { readonly id: string; readonly mergedInto?: string; }
export type LinkKind = 'requires' | 'instantiates' | 'deepens' | 'relates';
export interface Link { readonly fromId: string; readonly toId: string; readonly kind: LinkKind; }
export interface Aim {
  readonly createdSeq?: number;
  readonly id: string;
  readonly conceptId: string;
  readonly ownerKind: 'learner' | 'goal';
  readonly ownerId: string;
  readonly level: Level;
  readonly parked: boolean;
}
export interface ConceptMastery {
  readonly conceptId: string;
  readonly level: Level;
  readonly state: MasteryState;
  readonly provisional?: boolean;
}
export interface Graph {
  readonly concepts: readonly Concept[];
  readonly links: readonly Link[];
  readonly aims: readonly Aim[];
}
export interface AimDecision {
  readonly aimId: string;
  readonly action: 'keep' | 'lower' | 'drop';
  readonly newLevel?: Level;
}
