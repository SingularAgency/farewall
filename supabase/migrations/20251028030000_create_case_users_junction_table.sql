-- Create many-to-many relationship between users and cases
-- This migration creates a junction table to allow multiple users to be associated with the same case

-- Create the junction table for users and cases
CREATE TABLE case_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(case_id, user_id)
);

-- Migrate existing data: for each case, create a case_users entry from cases.user_id
INSERT INTO case_users (case_id, user_id, created_at)
SELECT id, user_id, created_at
FROM cases
WHERE user_id IS NOT NULL;

-- Create indexes for better performance
CREATE INDEX idx_case_users_case_id ON case_users(case_id);
CREATE INDEX idx_case_users_user_id ON case_users(user_id);
CREATE INDEX idx_case_users_created_at ON case_users(created_at);

-- Enable Row Level Security on the junction table
ALTER TABLE case_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for case_users table
-- Users can view their own case associations
CREATE POLICY "Users can view own case associations" ON case_users
    FOR SELECT USING (user_id = auth.uid());

-- Users can create case associations (for cases they're associated with or are creating)
CREATE POLICY "Users can create case associations" ON case_users
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM case_users cu
            WHERE cu.case_id = case_users.case_id AND cu.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can delete their own case associations
CREATE POLICY "Users can delete own case associations" ON case_users
    FOR DELETE USING (user_id = auth.uid());

-- Admins can manage all case associations
CREATE POLICY "Admins can manage all case associations" ON case_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Drop old cases policies that reference user_id
DROP POLICY IF EXISTS "Users can view own cases" ON cases;
DROP POLICY IF EXISTS "Users can create cases" ON cases;
DROP POLICY IF EXISTS "Users can update own cases" ON cases;
DROP POLICY IF EXISTS "Users can delete own cases" ON cases;

-- Create new cases policies that use the junction table
-- Users can view cases they're associated with
CREATE POLICY "Users can view associated cases" ON cases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM case_users 
            WHERE case_id = cases.id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can create cases (and will need to add themselves via case_users separately)
CREATE POLICY "Users can create cases" ON cases
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Users can update cases they're associated with
CREATE POLICY "Users can update associated cases" ON cases
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM case_users 
            WHERE case_id = cases.id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can delete cases they're associated with
CREATE POLICY "Users can delete associated cases" ON cases
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM case_users 
            WHERE case_id = cases.id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Update task instances policies to use junction table instead of cases.user_id
DROP POLICY IF EXISTS "Users can view relevant task instances" ON task_instances;
DROP POLICY IF EXISTS "Users can create task instances" ON task_instances;
DROP POLICY IF EXISTS "Users can update relevant task instances" ON task_instances;

-- Users can view task instances for cases they're associated with or assigned to them
CREATE POLICY "Users can view relevant task instances" ON task_instances
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM case_users cu
            WHERE cu.case_id = task_instances.case_id AND cu.user_id = auth.uid()
        ) OR
        assigned_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can create task instances for cases they're associated with
CREATE POLICY "Users can create task instances" ON task_instances
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM case_users cu
            WHERE cu.case_id = task_instances.case_id AND cu.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can update task instances for cases they're associated with or assigned to them
CREATE POLICY "Users can update relevant task instances" ON task_instances
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM case_users cu
            WHERE cu.case_id = task_instances.case_id AND cu.user_id = auth.uid()
        ) OR
        assigned_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Update task instance steps policies
DROP POLICY IF EXISTS "Users can view relevant task instance steps" ON task_instance_steps;
DROP POLICY IF EXISTS "Users can update relevant task instance steps" ON task_instance_steps;
DROP POLICY IF EXISTS "Users can insert relevant task instance steps" ON task_instance_steps;

CREATE POLICY "Users can view relevant task instance steps" ON task_instance_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM task_instances ti
            JOIN case_users cu ON ti.case_id = cu.case_id
            WHERE ti.id = task_instance_steps.task_instance_id 
            AND (cu.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can update relevant task instance steps" ON task_instance_steps
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM task_instances ti
            JOIN case_users cu ON ti.case_id = cu.case_id
            WHERE ti.id = task_instance_steps.task_instance_id 
            AND (cu.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can insert relevant task instance steps" ON task_instance_steps
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM task_instances ti
            JOIN case_users cu ON ti.case_id = cu.case_id
            WHERE ti.id = task_instance_steps.task_instance_id 
            AND (cu.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Update notes policies
DROP POLICY IF EXISTS "Users can view relevant notes" ON notes;
DROP POLICY IF EXISTS "Users can create notes" ON notes;

CREATE POLICY "Users can view relevant notes" ON notes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM task_instances ti
            JOIN case_users cu ON ti.case_id = cu.case_id
            WHERE ti.id = notes.task_instance_id 
            AND (cu.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can create notes" ON notes
    FOR INSERT WITH CHECK (
        author_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM task_instances ti
            JOIN case_users cu ON ti.case_id = cu.case_id
            WHERE ti.id = notes.task_instance_id 
            AND (cu.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        )
    );

-- Update attachments policies
DROP POLICY IF EXISTS "Users can view relevant attachments" ON attachments;
DROP POLICY IF EXISTS "Users can create attachments" ON attachments;

CREATE POLICY "Users can view relevant attachments" ON attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM notes n
            JOIN task_instances ti ON n.task_instance_id = ti.id
            JOIN case_users cu ON ti.case_id = cu.case_id
            WHERE n.id = attachments.note_id 
            AND (cu.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can create attachments" ON attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM notes n
            JOIN task_instances ti ON n.task_instance_id = ti.id
            JOIN case_users cu ON ti.case_id = cu.case_id
            WHERE n.id = attachments.note_id 
            AND (cu.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        )
    );

-- Remove the user_id column from cases table and its index
-- Since we now use the junction table, the direct user_id column is no longer needed
DROP INDEX IF EXISTS idx_cases_user_id;
ALTER TABLE cases DROP COLUMN IF EXISTS user_id;

