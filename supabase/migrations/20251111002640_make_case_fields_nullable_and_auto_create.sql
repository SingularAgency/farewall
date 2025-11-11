-- Make case fields nullable to allow auto-creation on user registration
-- Users can update these fields later with actual information

-- Make deceased_name and date_of_death nullable
ALTER TABLE cases
ALTER COLUMN deceased_name DROP NOT NULL,
ALTER COLUMN date_of_death DROP NOT NULL;

-- Update handle_new_user to automatically create a case for each new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_case_id UUID;
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
    
    -- Create a new case for this user (with NULL values that user can update later)
    INSERT INTO cases (deceased_name, date_of_death, created_at, updated_at)
    VALUES (NULL, NULL, NOW(), NOW())
    RETURNING id INTO new_case_id;
    
    -- Add user to case_users (this will trigger task instance creation)
    INSERT INTO case_users (case_id, user_id, created_at)
    VALUES (new_case_id, NEW.id, NOW())
    ON CONFLICT (case_id, user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

