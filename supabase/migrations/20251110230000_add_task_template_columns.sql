-- Add individual columns to task_templates table instead of using JSONB metadata
-- This migration replaces the metadata JSONB approach with explicit columns

-- Create enum for task phase
CREATE TYPE task_phase AS ENUM ('immediately', 'first-month', 'months-2-3', 'months-3-6', 'beyond');

-- Create enum for task priority
CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low');

-- Create enum for contact method
CREATE TYPE contact_method AS ENUM ('In-Person', 'Online', 'Mail', 'Phone', 'Email');

-- Add all task metadata columns
ALTER TABLE task_templates
ADD COLUMN phase task_phase,
ADD COLUMN timeframe TEXT,
ADD COLUMN priority task_priority,
ADD COLUMN can_delegate BOOLEAN DEFAULT false,
ADD COLUMN contact_methods contact_method[],
ADD COLUMN required_documents TEXT[],
ADD COLUMN why_it_matters TEXT,
ADD COLUMN human_insight TEXT,
ADD COLUMN who_to_contact TEXT,
ADD COLUMN how_to_find_contact TEXT,
ADD COLUMN what_to_expect TEXT,
ADD COLUMN suggested_professionals TEXT,
ADD COLUMN what_success_looks_like TEXT,
ADD COLUMN suggested_quantity TEXT,
ADD COLUMN delegation_requirements TEXT,
ADD COLUMN resources TEXT[],
ADD COLUMN downloadable_guides TEXT[],
ADD COLUMN pro_tips TEXT,
ADD COLUMN related_task_ids UUID[],
ADD COLUMN unlocks_other_steps BOOLEAN DEFAULT false,
ADD COLUMN depends_on_task_id UUID REFERENCES task_templates(id) ON DELETE SET NULL;

-- Create indexes for commonly queried columns
CREATE INDEX idx_task_templates_phase ON task_templates(phase);
CREATE INDEX idx_task_templates_priority ON task_templates(priority);
CREATE INDEX idx_task_templates_depends_on ON task_templates(depends_on_task_id);
CREATE INDEX idx_task_templates_related_tasks ON task_templates USING GIN(related_task_ids);

-- Migrate existing data from metadata JSONB to columns (if any exists)
-- This will be empty on fresh installs, but useful for existing data
UPDATE task_templates
SET
  phase = (metadata->>'phase')::task_phase,
  timeframe = metadata->>'timeframe',
  priority = (metadata->>'priority')::task_priority,
  can_delegate = (metadata->>'canDelegate')::boolean,
  contact_methods = ARRAY(SELECT jsonb_array_elements_text(metadata->'contactMethods'))::contact_method[],
  required_documents = ARRAY(SELECT jsonb_array_elements_text(metadata->'requiredDocuments')),
  why_it_matters = metadata->>'whyItMatters',
  human_insight = metadata->>'humanInsight',
  who_to_contact = metadata->>'whoToContact',
  how_to_find_contact = metadata->>'howToFindContact',
  what_to_expect = metadata->>'whatToExpect',
  suggested_professionals = metadata->>'suggestedProfessionals',
  what_success_looks_like = metadata->>'whatSuccessLooksLike',
  suggested_quantity = metadata->>'suggestedQuantity',
  delegation_requirements = metadata->>'delegationRequirements',
  resources = ARRAY(SELECT jsonb_array_elements_text(metadata->'resources')),
  downloadable_guides = ARRAY(SELECT jsonb_array_elements_text(metadata->'downloadableGuides')),
  pro_tips = metadata->>'proTips',
  unlocks_other_steps = (metadata->>'unlocksOtherSteps')::boolean
WHERE metadata IS NOT NULL AND metadata != '{}'::jsonb;

-- Note: related_task_ids and depends_on_task_id will be populated by the seed script
-- since they need to reference task IDs that may not exist yet during migration

-- Drop the metadata column and its indexes (commented out for safety - uncomment after verifying migration)
-- DROP INDEX IF EXISTS idx_task_templates_metadata;
-- DROP INDEX IF EXISTS idx_task_templates_metadata_phase;
-- DROP INDEX IF EXISTS idx_task_templates_metadata_priority;
-- ALTER TABLE task_templates DROP COLUMN metadata;

