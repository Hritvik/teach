CREATE TABLE item_offers(id TEXT PRIMARY KEY,learner_id TEXT NOT NULL REFERENCES learners(id),item_id TEXT NOT NULL,item_version INTEGER NOT NULL,verification_id TEXT NOT NULL REFERENCES item_verifications(id),session_id TEXT NOT NULL REFERENCES sessions(id),connection_id TEXT NOT NULL,recovery_generation INTEGER NOT NULL,purpose TEXT NOT NULL,review_lease_json TEXT,state TEXT NOT NULL CHECK(state IN ('offered','answered')),created_at TEXT NOT NULL,FOREIGN KEY(item_id,item_version) REFERENCES item_versions(item_id,item_version));
ALTER TABLE grade_jobs ADD COLUMN actor_connection_id TEXT NOT NULL DEFAULT '';
ALTER TABLE grade_jobs ADD COLUMN prompt_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE grade_jobs ADD COLUMN schema_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE grade_jobs ADD COLUMN dispute_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN review_lease_json TEXT;
ALTER TABLE evidence ADD COLUMN scheduling_eligible INTEGER NOT NULL DEFAULT 1 CHECK(scheduling_eligible IN (0,1));
CREATE INDEX assessment_job_queue ON grade_jobs(status,created_at);
