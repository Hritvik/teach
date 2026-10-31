PRAGMA foreign_keys = ON;
CREATE TABLE meta(singleton INTEGER PRIMARY KEY CHECK(singleton=1), generation INTEGER NOT NULL DEFAULT 1, write_enabled INTEGER NOT NULL DEFAULT 1 CHECK(write_enabled IN (0,1)), schema_version INTEGER NOT NULL DEFAULT 1, protocol_version INTEGER NOT NULL DEFAULT 1, rules_version INTEGER NOT NULL DEFAULT 1, graph_revision INTEGER NOT NULL DEFAULT 0, projection_revision INTEGER NOT NULL DEFAULT 0, meta_revision INTEGER NOT NULL DEFAULT 0, maintenance_op_id TEXT, maintenance_phase TEXT);
INSERT INTO meta(singleton) VALUES(1);
CREATE TABLE learners(id TEXT PRIMARY KEY, timezone TEXT NOT NULL, balance_urgent_pct INTEGER NOT NULL DEFAULT 70 CHECK(balance_urgent_pct BETWEEN 0 AND 100), preferences_json TEXT NOT NULL DEFAULT '{}');
CREATE UNIQUE INDEX one_learner ON learners((1));
CREATE TABLE rules_manifests(id INTEGER PRIMARY KEY, rules_json TEXT NOT NULL, scheduler_engine TEXT NOT NULL, engine_build_hash TEXT NOT NULL, parameters_json TEXT NOT NULL, created_seq INTEGER NOT NULL DEFAULT 0);
CREATE TABLE event_log(seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE, learner_id TEXT NOT NULL REFERENCES learners(id), generation INTEGER NOT NULL, request_id TEXT NOT NULL, operation TEXT NOT NULL, actor_json TEXT NOT NULL, reason TEXT NOT NULL, received_at TEXT NOT NULL, payload_json TEXT NOT NULL, UNIQUE(learner_id,generation,request_id));
CREATE TABLE operation_receipts(learner_id TEXT NOT NULL REFERENCES learners(id), generation INTEGER NOT NULL, request_id TEXT NOT NULL, operation TEXT NOT NULL, semantic_sha256 TEXT NOT NULL, result_json TEXT NOT NULL, committed_seq INTEGER NOT NULL, PRIMARY KEY(learner_id,generation,request_id));
CREATE TABLE write_guards(learner_id TEXT NOT NULL, generation INTEGER NOT NULL, request_id TEXT NOT NULL, valid INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(learner_id,generation,request_id));
CREATE TABLE concepts(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  realm TEXT NOT NULL,
  area TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  purpose TEXT NOT NULL,
  origin TEXT NOT NULL CHECK(origin IN ('goal','inquiry','lesson','frontier','seed')),
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
  merged_into TEXT REFERENCES concepts(id)
);
CREATE TABLE anchors(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL CHECK(kind IN ('code','passage')),
  source_uri TEXT NOT NULL,
  source_version TEXT NOT NULL,
  locator_json TEXT NOT NULL CHECK(json_valid(locator_json)),
  quoted_text TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('verified','held','changed')),
  checked_at TEXT NOT NULL
);
CREATE TABLE source_captures(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  anchor_id TEXT NOT NULL REFERENCES anchors(id),
  anchor_version INTEGER NOT NULL,
  source_uri TEXT NOT NULL,
  source_version TEXT NOT NULL,
  locator_json TEXT NOT NULL,
  captured_text TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  fetch_provenance_json TEXT NOT NULL
);
CREATE TABLE concept_anchors(
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  anchor_id TEXT NOT NULL REFERENCES anchors(id),
  PRIMARY KEY(concept_id,anchor_id)
);
CREATE TABLE links(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  from_id TEXT NOT NULL REFERENCES concepts(id),
  to_id TEXT NOT NULL REFERENCES concepts(id),
  kind TEXT NOT NULL CHECK(kind IN ('requires','instantiates','deepens','relates')),
  CHECK(from_id<>to_id),
  UNIQUE(learner_id,from_id,to_id,kind)
);
CREATE TABLE goals(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  source_json TEXT NOT NULL CHECK(json_valid(source_json)),
  state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','closed','abandoned')),
  urgent INTEGER NOT NULL DEFAULT 0 CHECK(urgent IN (0,1)),
  due_at TEXT,
  last_touched_at TEXT NOT NULL,
  closed_seq INTEGER
);
CREATE TABLE aims(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  owner_kind TEXT NOT NULL CHECK(owner_kind IN ('learner','goal')),
  owner_id TEXT NOT NULL,
  level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 4),
  parked INTEGER NOT NULL DEFAULT 0 CHECK(parked IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE sessions(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  exit_ticket_json TEXT,
  muddiest_point TEXT,
  what_helped TEXT
);
CREATE TABLE session_agents(
  session_id TEXT NOT NULL REFERENCES sessions(id),
  connection_id TEXT NOT NULL,
  reported_agent TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY(session_id,connection_id)
);
CREATE TABLE session_goals(
  session_id TEXT NOT NULL REFERENCES sessions(id),
  goal_id TEXT NOT NULL REFERENCES goals(id),
  PRIMARY KEY(session_id,goal_id)
);
CREATE TABLE inquiries(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  text TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('answered','inbox')),
  answer_json TEXT,
  what_would_resolve TEXT
);
CREATE TABLE inquiry_concepts(
  inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  PRIMARY KEY(inquiry_id,concept_id)
);
CREATE TABLE items(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 4),
  type TEXT NOT NULL,
  current_item_version INTEGER NOT NULL DEFAULT 1,
  current_verification_id TEXT,
  state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','verified','held','retired'))
);
CREATE TABLE item_versions(
  item_id TEXT NOT NULL REFERENCES items(id),
  item_version INTEGER NOT NULL CHECK(item_version>0),
  stem TEXT NOT NULL,
  context_json TEXT NOT NULL,
  assessment_form TEXT NOT NULL CHECK(assessment_form IN ('recognition','production')),
  key_points_json TEXT NOT NULL,
  distractors_json TEXT NOT NULL,
  exact_key_json TEXT,
  content_sha256 TEXT NOT NULL,
  PRIMARY KEY(item_id,item_version)
);
CREATE TABLE item_verifications(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  item_id TEXT NOT NULL,
  item_version INTEGER NOT NULL,
  capture_set_hash TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('supported','unsupported','uncertain','invalidated')),
  result_json TEXT NOT NULL,
  verifier_provenance_json TEXT NOT NULL,
  seq INTEGER NOT NULL,
  result_job_id TEXT NOT NULL,
  supersedes_verification_id TEXT REFERENCES item_verifications(id),
  FOREIGN KEY(item_id,item_version) REFERENCES item_versions(item_id,item_version),
  UNIQUE(item_id,item_version,capture_set_hash,prompt_version,result_job_id)
);
CREATE TABLE attempts(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  item_id TEXT NOT NULL,
  item_version INTEGER NOT NULL,
  answer TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK(confidence IN ('sure','think','guess','unknown')),
  help_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  local_day TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','graded','disputed','ungraded')),
  review_occurrence_id TEXT,
  verification_id TEXT NOT NULL REFERENCES item_verifications(id),
  FOREIGN KEY(item_id,item_version) REFERENCES item_versions(item_id,item_version)
);
CREATE TABLE evidence(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 4),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  attempt_id TEXT REFERENCES attempts(id),
  kind TEXT NOT NULL,
  content_grade TEXT NOT NULL CHECK(content_grade IN ('correct','partial','wrong','na')),
  strength TEXT NOT NULL CHECK(strength IN ('strong','practice','miss','unresolved','exposure')),
  confidence TEXT NOT NULL,
  help_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  local_day TEXT NOT NULL,
  source_json TEXT NOT NULL,
  content TEXT,
  rules_version INTEGER NOT NULL
);
CREATE TABLE record_corrections(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  root_record_id TEXT NOT NULL,
  expected_effective_revision INTEGER NOT NULL CHECK(expected_effective_revision>=0),
  effective_revision INTEGER NOT NULL CHECK(effective_revision>0),
  action TEXT NOT NULL CHECK(action IN ('amend','retract','dispute','resolve')),
  replacement_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  seq INTEGER NOT NULL,
  UNIQUE(root_record_id,effective_revision)
);
CREATE TABLE misconceptions(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  wording TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('open','closed')),
  created_from_record_id TEXT NOT NULL,
  closing_attempts_json TEXT NOT NULL
);
CREATE TABLE review_schedules(
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 4),
  scheduler_manifest_id INTEGER NOT NULL REFERENCES rules_manifests(id),
  card_json TEXT NOT NULL,
  last_rated_seq INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  schedule_revision INTEGER NOT NULL CHECK(schedule_revision>0),
  suppressed_session_id TEXT REFERENCES sessions(id),
  PRIMARY KEY(concept_id,level)
);
CREATE TABLE review_occurrences(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 4),
  schedule_revision INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('open','reserved','consumed','superseded')),
  lease_generation INTEGER NOT NULL,
  lease_session_id TEXT REFERENCES sessions(id),
  lease_until TEXT,
  consumed_attempt_id TEXT REFERENCES attempts(id)
);
CREATE TABLE mastery_projection(
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 4),
  state TEXT NOT NULL CHECK(state IN ('Unknown','Exposed','Shaky','Solid','Secure')),
  strong_days_json TEXT NOT NULL,
  stale INTEGER NOT NULL DEFAULT 0 CHECK(stale IN (0,1)),
  fading INTEGER NOT NULL DEFAULT 0 CHECK(fading IN (0,1)),
  provisional INTEGER NOT NULL DEFAULT 0 CHECK(provisional IN (0,1)),
  as_of_seq INTEGER NOT NULL,
  rules_version INTEGER NOT NULL,
  projection_revision INTEGER NOT NULL,
  PRIMARY KEY(concept_id,level)
);
CREATE TABLE learner_notes(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  text TEXT NOT NULL
);
CREATE TABLE grade_jobs(
  job_id TEXT PRIMARY KEY,
  identity_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  attempt_id TEXT REFERENCES attempts(id),
  item_id TEXT NOT NULL,
  item_version INTEGER NOT NULL,
  key_version INTEGER NOT NULL,
  verification_id TEXT,
  capture_set_hash TEXT NOT NULL,
  protocol_version INTEGER NOT NULL,
  rules_version INTEGER NOT NULL,
  prompt_version INTEGER NOT NULL,
  model_snapshot TEXT NOT NULL,
  recovery_generation INTEGER NOT NULL,
  job_revision INTEGER NOT NULL,
  status TEXT NOT NULL,
  pending_reason TEXT,
  dispatch_id TEXT,
  lease_until TEXT,
  physical_call_count INTEGER NOT NULL DEFAULT 0,
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(item_id,item_version) REFERENCES item_versions(item_id,item_version)
);
CREATE TABLE books(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL CHECK(kind IN ('planned','compiled')),
  title TEXT NOT NULL,
  goal_id TEXT REFERENCES goals(id)
);
CREATE TABLE chapters(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  book_id TEXT NOT NULL REFERENCES books(id),
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  body_json TEXT NOT NULL
);
CREATE TABLE chapter_concepts(
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  aim_level INTEGER NOT NULL CHECK(aim_level BETWEEN 1 AND 4),
  PRIMARY KEY(chapter_id,concept_id)
);
CREATE TABLE chapter_reads(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  seq INTEGER NOT NULL
);
CREATE TABLE cards(
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_seq INTEGER NOT NULL DEFAULT 0,
  updated_seq INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  concept_id TEXT REFERENCES concepts(id),
  chapter_id TEXT REFERENCES chapters(id),
  body_json TEXT NOT NULL
);
CREATE INDEX concept_realm ON concepts(learner_id,realm,area);
CREATE INDEX due_reviews ON review_schedules(learner_id,due_at);
CREATE INDEX concept_evidence ON evidence(learner_id,concept_id,level,seq);
CREATE UNIQUE INDEX one_attempt_evidence ON evidence(attempt_id,concept_id,level,kind) WHERE attempt_id IS NOT NULL;
CREATE UNIQUE INDEX active_aim_owner ON aims(learner_id,concept_id,owner_kind,owner_id) WHERE active=1;
CREATE UNIQUE INDEX one_review_occurrence ON review_occurrences(concept_id,level) WHERE state IN ('open','reserved');
CREATE INDEX goal_urgency ON goals(learner_id,state,urgent,due_at);
CREATE INDEX open_sessions ON sessions(learner_id,state);
CREATE VIEW v_concepts AS SELECT id,learner_id,realm,area,slug,title,purpose,origin,archived,merged_into,version FROM concepts;
CREATE VIEW v_aims AS SELECT id,learner_id,concept_id,owner_kind,owner_id,level,parked,active,version FROM aims;
CREATE VIEW v_mastery AS SELECT learner_id,concept_id,level,state,stale,fading,provisional,as_of_seq,rules_version,projection_revision FROM mastery_projection;
CREATE VIEW v_goals AS SELECT id,learner_id,title,state,urgent,due_at,version FROM goals;
