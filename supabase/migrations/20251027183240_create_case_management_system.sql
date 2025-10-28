-- Create Case Management System tables
-- This migration creates the complete schema for the Task & Case Management System

-- First, let's drop the old task management tables to replace with new schema
DROP TABLE IF EXISTS task_attachments CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS task_assignments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;

-- Create enum for task instance status
CREATE TYPE task_instance_status AS ENUM ('pending', 'in_progress', 'done');

-- Create cases table
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    deceased_name TEXT NOT NULL,
    date_of_death DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task templates table
CREATE TABLE task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task steps table
CREATE TABLE task_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task instances table
CREATE TABLE task_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    task_template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
    assigned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status task_instance_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task instance steps table
CREATE TABLE task_instance_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_instance_id UUID NOT NULL REFERENCES task_instances(id) ON DELETE CASCADE,
    task_step_id UUID NOT NULL REFERENCES task_steps(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_instance_id, task_step_id)
);

-- Create articles table
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    content_url TEXT NOT NULL,
    read_time_min INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task template articles junction table
CREATE TABLE task_template_articles (
    task_template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (task_template_id, article_id)
);

-- Create notes table
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_instance_id UUID NOT NULL REFERENCES task_instances(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create attachments table
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_cases_user_id ON cases(user_id);
CREATE INDEX idx_cases_created_at ON cases(created_at);
CREATE INDEX idx_cases_date_of_death ON cases(date_of_death);

CREATE INDEX idx_task_steps_template_id ON task_steps(task_template_id);
CREATE INDEX idx_task_steps_order ON task_steps("order");

CREATE INDEX idx_task_instances_case_id ON task_instances(case_id);
CREATE INDEX idx_task_instances_template_id ON task_instances(task_template_id);
CREATE INDEX idx_task_instances_assigned_user_id ON task_instances(assigned_user_id);
CREATE INDEX idx_task_instances_status ON task_instances(status);
CREATE INDEX idx_task_instances_created_at ON task_instances(created_at);

CREATE INDEX idx_task_instance_steps_instance_id ON task_instance_steps(task_instance_id);
CREATE INDEX idx_task_instance_steps_step_id ON task_instance_steps(task_step_id);
CREATE INDEX idx_task_instance_steps_completed ON task_instance_steps(completed);

CREATE INDEX idx_task_template_articles_template_id ON task_template_articles(task_template_id);
CREATE INDEX idx_task_template_articles_article_id ON task_template_articles(article_id);

CREATE INDEX idx_notes_task_instance_id ON notes(task_instance_id);
CREATE INDEX idx_notes_author_id ON notes(author_id);
CREATE INDEX idx_notes_created_at ON notes(created_at);

CREATE INDEX idx_attachments_note_id ON attachments(note_id);

-- Enable Row Level Security on all tables
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_instance_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_template_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Cases policies
-- Users can view their own cases
CREATE POLICY "Users can view own cases" ON cases
    FOR SELECT USING (user_id = auth.uid());

-- Users can create cases
CREATE POLICY "Users can create cases" ON cases
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own cases
CREATE POLICY "Users can update own cases" ON cases
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own cases
CREATE POLICY "Users can delete own cases" ON cases
    FOR DELETE USING (user_id = auth.uid());

-- Task templates policies (read-only for users, full access for admins)
-- Everyone can view task templates
CREATE POLICY "Everyone can view task templates" ON task_templates
    FOR SELECT USING (true);

-- Only admins can manage task templates
CREATE POLICY "Admins can insert task templates" ON task_templates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update task templates" ON task_templates
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete task templates" ON task_templates
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Task steps policies (same as templates)
CREATE POLICY "Everyone can view task steps" ON task_steps
    FOR SELECT USING (true);

CREATE POLICY "Admins can insert task steps" ON task_steps
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update task steps" ON task_steps
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete task steps" ON task_steps
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Task instances policies
-- Users can view task instances for their cases or assigned to them
CREATE POLICY "Users can view relevant task instances" ON task_instances
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cases 
            WHERE id = task_instances.case_id AND user_id = auth.uid()
        ) OR
        assigned_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can create task instances for their cases
CREATE POLICY "Users can create task instances" ON task_instances
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM cases 
            WHERE id = task_instances.case_id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can update task instances for their cases or assigned to them
CREATE POLICY "Users can update relevant task instances" ON task_instances
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM cases 
            WHERE id = task_instances.case_id AND user_id = auth.uid()
        ) OR
        assigned_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can delete task instances
CREATE POLICY "Admins can delete task instances" ON task_instances
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Task instance steps policies
-- Users can view steps for accessible task instances
CREATE POLICY "Users can view relevant task instance steps" ON task_instance_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM task_instances ti
            JOIN cases c ON ti.case_id = c.id
            WHERE ti.id = task_instance_steps.task_instance_id 
            AND (c.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can update steps for accessible task instances
CREATE POLICY "Users can update relevant task instance steps" ON task_instance_steps
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM task_instances ti
            JOIN cases c ON ti.case_id = c.id
            WHERE ti.id = task_instance_steps.task_instance_id 
            AND (c.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can insert steps for accessible task instances
CREATE POLICY "Users can insert relevant task instance steps" ON task_instance_steps
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM task_instances ti
            JOIN cases c ON ti.case_id = c.id
            WHERE ti.id = task_instance_steps.task_instance_id 
            AND (c.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Articles policies (read-only for users, full access for admins)
CREATE POLICY "Everyone can view articles" ON articles
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage articles" ON articles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Task template articles policies
CREATE POLICY "Everyone can view task template articles" ON task_template_articles
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage task template articles" ON task_template_articles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Notes policies
-- Users can view notes for accessible task instances
CREATE POLICY "Users can view relevant notes" ON notes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM task_instances ti
            JOIN cases c ON ti.case_id = c.id
            WHERE ti.id = notes.task_instance_id 
            AND (c.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can create notes for accessible task instances
CREATE POLICY "Users can create notes" ON notes
    FOR INSERT WITH CHECK (
        author_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM task_instances ti
            JOIN cases c ON ti.case_id = c.id
            WHERE ti.id = notes.task_instance_id 
            AND (c.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        )
    );

-- Users can update their own notes
CREATE POLICY "Users can update own notes" ON notes
    FOR UPDATE USING (author_id = auth.uid());

-- Users can delete their own notes
CREATE POLICY "Users can delete own notes" ON notes
    FOR DELETE USING (author_id = auth.uid());

-- Attachments policies
-- Users can view attachments for accessible notes
CREATE POLICY "Users can view relevant attachments" ON attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM notes n
            JOIN task_instances ti ON n.task_instance_id = ti.id
            JOIN cases c ON ti.case_id = c.id
            WHERE n.id = attachments.note_id 
            AND (c.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can create attachments for accessible notes
CREATE POLICY "Users can create attachments" ON attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM notes n
            JOIN task_instances ti ON n.task_instance_id = ti.id
            JOIN cases c ON ti.case_id = c.id
            WHERE n.id = attachments.note_id 
            AND (c.user_id = auth.uid() OR ti.assigned_user_id = auth.uid())
        )
    );

-- Users can delete attachments for their own notes
CREATE POLICY "Users can delete own attachments" ON attachments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM notes n
            WHERE n.id = attachments.note_id AND n.author_id = auth.uid()
        )
    );

-- Create triggers to automatically update updated_at timestamps
CREATE TRIGGER update_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_templates_updated_at
    BEFORE UPDATE ON task_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_steps_updated_at
    BEFORE UPDATE ON task_steps
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_instances_updated_at
    BEFORE UPDATE ON task_instances
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_instance_steps_updated_at
    BEFORE UPDATE ON task_instance_steps
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_articles_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically set completed_at when step is completed
CREATE OR REPLACE FUNCTION public.set_task_instance_step_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed = TRUE AND OLD.completed = FALSE THEN
        NEW.completed_at = NOW();
    ELSIF NEW.completed = FALSE AND OLD.completed = TRUE THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set completed_at for task instance steps
CREATE TRIGGER set_task_instance_step_completed_at_trigger
    BEFORE UPDATE ON task_instance_steps
    FOR EACH ROW EXECUTE FUNCTION public.set_task_instance_step_completed_at();

-- Create function to automatically create task instance steps when task instance is created
CREATE OR REPLACE FUNCTION public.create_task_instance_steps()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO task_instance_steps (task_instance_id, task_step_id)
    SELECT NEW.id, ts.id
    FROM task_steps ts
    WHERE ts.task_template_id = NEW.task_template_id
    ORDER BY ts."order";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create task instance steps
CREATE TRIGGER create_task_instance_steps_trigger
    AFTER INSERT ON task_instances
    FOR EACH ROW EXECUTE FUNCTION public.create_task_instance_steps();
