-- Add step type column to task_steps table
-- Steps now have a type field: "action" or "instruction"

-- Create enum for step type
CREATE TYPE step_type AS ENUM ('action', 'instruction');

-- Add type column to task_steps
ALTER TABLE task_steps
ADD COLUMN step_type step_type DEFAULT 'instruction';

-- Update existing steps: if they have communication_helpers, they're actions, otherwise instructions
UPDATE task_steps
SET step_type = CASE
    WHEN communication_helpers IS NOT NULL AND communication_helpers != '{}'::jsonb THEN 'action'::step_type
    ELSE 'instruction'::step_type
END;

-- Make the column NOT NULL after setting defaults
ALTER TABLE task_steps
ALTER COLUMN step_type SET NOT NULL;

-- Create index for filtering by step type
CREATE INDEX idx_task_steps_step_type ON task_steps(step_type);

