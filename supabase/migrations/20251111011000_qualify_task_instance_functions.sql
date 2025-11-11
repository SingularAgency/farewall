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
    SELECT COUNT(*) INTO existing_instance_count
    FROM public.task_instances
    WHERE case_id = NEW.case_id;

    IF existing_instance_count = 0 THEN
        FOR template_record IN
            SELECT id FROM public.task_templates
        LOOP
            SELECT id INTO new_instance_id
            FROM public.task_instances
            WHERE case_id = NEW.case_id
              AND task_template_id = template_record.id
            LIMIT 1;

            IF new_instance_id IS NULL THEN
                INSERT INTO public.task_instances (
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

            IF new_instance_id IS NOT NULL THEN
                INSERT INTO public.task_instance_steps (task_instance_id, task_step_id, completed, created_at, updated_at)
                SELECT
                    new_instance_id,
                    ts.id,
                    false,
                    NOW(),
                    NOW()
                FROM public.task_steps ts
                WHERE ts.task_template_id = template_record.id
                ORDER BY ts."order"
                ON CONFLICT (task_instance_id, task_step_id) DO NOTHING;
            END IF;
        END LOOP;
    ELSE
        FOR instance_record IN
            SELECT ti.id, ti.task_template_id
            FROM public.task_instances ti
            WHERE ti.case_id = NEW.case_id
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.task_instance_steps 
                WHERE task_instance_id = instance_record.id
            ) THEN
                INSERT INTO public.task_instance_steps (task_instance_id, task_step_id, completed, created_at, updated_at)
                SELECT
                    instance_record.id,
                    ts.id,
                    false,
                    NOW(),
                    NOW()
                FROM public.task_steps ts
                WHERE ts.task_template_id = instance_record.task_template_id
                ORDER BY ts."order"
                ON CONFLICT (task_instance_id, task_step_id) DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_task_instance_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.task_instance_steps (task_instance_id, task_step_id)
    SELECT NEW.id, ts.id
    FROM public.task_steps ts
    WHERE ts.task_template_id = NEW.task_template_id
    ORDER BY ts."order";
    RETURN NEW;
END;
$$;
