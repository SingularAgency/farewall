CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_case_id UUID;
BEGIN
    -- Create or update the user profile
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

    -- Create a new case for this user (with NULL values that the user can update later)
    INSERT INTO public.cases (deceased_name, date_of_death, created_at, updated_at)
    VALUES (NULL, NULL, NOW(), NOW())
    RETURNING id INTO new_case_id;

    -- Associate the user with the new case
    INSERT INTO public.case_users (case_id, user_id, created_at)
    VALUES (new_case_id, NEW.id, NOW())
    ON CONFLICT (case_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$;
