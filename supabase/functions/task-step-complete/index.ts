import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withAuth, AuthenticatedUser } from "../_shared/auth-middleware.ts"

interface CompleteTaskStepRequest {
  task_step_id?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function handleRequest(req: Request, user: AuthenticatedUser): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405,
        },
      )
    }

    const payload: CompleteTaskStepRequest = await req.json().catch(() => ({}))
    const taskStepId = payload.task_step_id

    if (!taskStepId) {
      return new Response(
        JSON.stringify({ error: 'task_step_id is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the task step
    const { data: taskStep, error: stepError } = await supabase
      .from('task_instance_steps')
      .select('id, task_instance_id, completed, completed_at')
      .eq('id', taskStepId)
      .single()

    if (stepError || !taskStep) {
      return new Response(
        JSON.stringify({ error: 'Task step not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        },
      )
    }

    // Fetch the related task instance to get case_id
    const { data: taskInstance, error: instanceError } = await supabase
      .from('task_instances')
      .select('id, case_id')
      .eq('id', taskStep.task_instance_id)
      .single()

    if (instanceError || !taskInstance) {
      return new Response(
        JSON.stringify({ error: 'Associated task instance not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        },
      )
    }

    // Verify the user has access to the case (admins bypass the check)
    if (user.role !== 'admin') {
      const { data: accessRecord, error: accessError } = await supabase
        .from('case_users')
        .select('id')
        .eq('case_id', taskInstance.case_id)
        .eq('user_id', user.id)
        .single()

      if (accessError || !accessRecord) {
        return new Response(
          JSON.stringify({ error: 'Access denied: You do not have access to this case' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          },
        )
      }
    }

    // If already completed, return current state
    if (taskStep.completed) {
      return new Response(
        JSON.stringify({
          message: 'Task step already completed',
          task_step: taskStep,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    const now = new Date().toISOString()

    const { data: updatedTaskStep, error: updateError } = await supabase
      .from('task_instance_steps')
      .update({
        completed: true,
        completed_at: now,
      })
      .eq('id', taskStepId)
      .select('id, task_instance_id, completed, completed_at')
      .single()

    if (updateError || !updatedTaskStep) {
      console.error('Failed to update task step:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to mark task step as complete' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    return new Response(
      JSON.stringify({
        message: 'Task step marked as complete',
        task_step: updatedTaskStep,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in task-step-complete function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
}

serve(withAuth(handleRequest))

