-- Add communication_helpers JSONB column to task_steps table
-- This column will store communication helper objects for each task step

ALTER TABLE task_steps 
ADD COLUMN communication_helpers JSONB DEFAULT '{}'::jsonb;

-- Add comment to document the column purpose
COMMENT ON COLUMN task_steps.communication_helpers IS 'JSONB object containing communication helper data for the task step';

-- Create an index on the communication_helpers column for better query performance
CREATE INDEX idx_task_steps_communication_helpers ON task_steps USING GIN (communication_helpers);
