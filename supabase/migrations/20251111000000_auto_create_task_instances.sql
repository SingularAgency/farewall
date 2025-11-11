-- Auto-create task instances when a case is created
-- This migration ensures task templates exist and creates task instances for new cases

-- Function to ensure all task templates exist (idempotent)
-- This is called when a user is created to ensure templates are seeded
-- The seed.sql file should be run during database setup, but this provides a safety net
CREATE OR REPLACE FUNCTION public.ensure_task_templates_exist()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    template_count INTEGER;
BEGIN
    -- Check if templates exist
    SELECT COUNT(*) INTO template_count FROM public.task_templates;
    
    -- If no templates exist, log a warning
    -- In production, seed.sql should be run during setup
    -- This function serves as a reminder that templates need to be seeded
    IF template_count = 0 THEN
        RAISE WARNING 'No task templates found. Please run seed.sql to populate task templates.';
    END IF;
    
    RETURN;
END;
$$;

-- Update handle_new_user to ensure task templates exist
-- Note: This doesn't create templates, but ensures they're checked
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Create user profile
    INSERT INTO public.profiles (id, name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email,
        'user'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        updated_at = NOW();
    
    -- Ensure task templates exist (this is a check, actual seeding happens via seed.sql)
    PERFORM public.ensure_task_templates_exist();
    
    RETURN NEW;
END;
$$;

-- Function to create task instances for all templates when a user is added to a case
-- This ensures that when a user is associated with a case, they get all task instances
-- and all task instance steps are created for all users
CREATE OR REPLACE FUNCTION public.create_task_instances_for_case_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    template_record RECORD;
    instance_record RECORD;
    step_record RECORD;
    existing_instance_count INTEGER;
    new_instance_id UUID;
BEGIN
    -- Check if task instances already exist for this case
    -- (to avoid duplicates if function is called multiple times)
    SELECT COUNT(*) INTO existing_instance_count
    FROM task_instances
    WHERE case_id = NEW.case_id;
    
    -- Only create instances if none exist yet (first user added to case)
    IF existing_instance_count = 0 THEN
        -- Create a task instance for each task template, assigned to this user
        FOR template_record IN 
            SELECT id FROM public.task_templates
        LOOP
            -- Check if instance already exists
            SELECT id INTO new_instance_id
            FROM task_instances
            WHERE case_id = NEW.case_id 
              AND task_template_id = template_record.id
            LIMIT 1;
            
            -- Only create if it doesn't exist
            IF new_instance_id IS NULL THEN
                INSERT INTO task_instances (
                    case_id,
                    task_template_id,
                    assigned_user_id,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (
                    NEW.case_id,
                    template_record.id,
                    NEW.user_id,
                    'pending',
                    NOW(),
                    NOW()
                )
                RETURNING id INTO new_instance_id;
            END IF;
            
            -- Explicitly create task instance steps for this instance
            -- This ensures steps are created even if the trigger doesn't fire
            IF new_instance_id IS NOT NULL THEN
                INSERT INTO task_instance_steps (task_instance_id, task_step_id, completed, created_at, updated_at)
                SELECT 
                    new_instance_id,
                    ts.id,
                    false,
                    NOW(),
                    NOW()
                FROM task_steps ts
                WHERE ts.task_template_id = template_record.id
                ORDER BY ts."order"
                ON CONFLICT (task_instance_id, task_step_id) DO NOTHING;
            END IF;
        END LOOP;
    ELSE
        -- If instances already exist, ensure steps exist for all instances in this case
        -- This handles cases where steps might not have been created previously
        FOR instance_record IN
            SELECT ti.id, ti.task_template_id
            FROM task_instances ti
            WHERE ti.case_id = NEW.case_id
        LOOP
            -- Check if steps exist for this instance
            IF NOT EXISTS (
                SELECT 1 FROM task_instance_steps 
                WHERE task_instance_id = instance_record.id
            ) THEN
                -- Create missing steps
                INSERT INTO task_instance_steps (task_instance_id, task_step_id, completed, created_at, updated_at)
                SELECT 
                    instance_record.id,
                    ts.id,
                    false,
                    NOW(),
                    NOW()
                FROM task_steps ts
                WHERE ts.task_template_id = instance_record.task_template_id
                ORDER BY ts."order"
                ON CONFLICT (task_instance_id, task_step_id) DO NOTHING;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to automatically create task instances when a user is added to a case
CREATE TRIGGER create_task_instances_on_case_user_added
    AFTER INSERT ON case_users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_task_instances_for_case_user();

-- Note: Task instance steps are automatically created by the existing trigger
-- create_task_instance_steps_trigger which fires after task_instances are inserted

