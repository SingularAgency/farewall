-- Extend task_templates table to store additional metadata from tasks.json
-- This migration adds a JSONB column to store all the rich metadata fields

-- Add metadata JSONB column to task_templates table
ALTER TABLE task_templates 
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment to document the column purpose
COMMENT ON COLUMN task_templates.metadata IS 'JSONB object containing additional task metadata: phase, timeframe, priority, canDelegate, contactMethods, requiredDocuments, whyItMatters, humanInsight, whoToContact, howToFindContact, whatToExpect, suggestedProfessionals, whatSuccessLooksLike, suggestedQuantity, delegationRequirements, resources, downloadableGuides, proTips, relatedTasks, unlocksOtherSteps, dependsOn';

-- Create GIN index on metadata column for efficient querying
CREATE INDEX idx_task_templates_metadata ON task_templates USING GIN (metadata);

-- Create specific indexes for commonly queried metadata fields
CREATE INDEX idx_task_templates_metadata_phase ON task_templates ((metadata->>'phase'));
CREATE INDEX idx_task_templates_metadata_priority ON task_templates ((metadata->>'priority'));

