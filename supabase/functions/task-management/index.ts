import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withAuth, AuthenticatedUser } from "../_shared/auth-middleware.ts"
import { 
  TaskInstanceWithDetails,
  TaskManagementResponse,
  TaskManagementStatistics
} from "../_shared/task-management/types.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

// Helper function to transform a single task instance
function transformTaskInstance(instance: any): TaskInstanceWithDetails {
  // Sort task steps by order
  const sortedSteps = instance.task_instance_steps
    ?.sort((a: any, b: any) => a.task_steps.order - b.task_steps.order)
    ?.map((step: any) => ({
      id: step.id, // Use task_instance_steps.id (the instance UUID) not task_steps.id (template UUID)
      title: step.task_steps.title,
      order: step.task_steps.order,
      instructions: step.task_steps.instructions,
      step_type: step.task_steps.step_type,
      communication_helpers: step.task_steps.communication_helpers,
      completed: step.completed,
      completed_at: step.completed_at
    })) || []

  // Sort notes by creation date (newest first)
  const sortedNotes = instance.notes
    ?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    ?.map((note: any) => ({
      id: note.id,
      content: note.content,
      created_at: note.created_at,
      author: note.profiles
    })) || []

  // Extract articles from the nested structure
  const articles = instance.task_templates?.task_template_articles
    ?.map((templateArticle: any) => templateArticle.articles) || []

  return {
    id: instance.id,
    case_id: instance.case_id,
    task_template_id: instance.task_template_id,
    assigned_user_id: instance.assigned_user_id,
    status: instance.status,
    created_at: instance.created_at,
    updated_at: instance.updated_at,
    case: instance.cases,
    task_template: instance.task_templates,
    assigned_user: instance.profiles,
    task_steps: sortedSteps,
    notes: sortedNotes,
    articles: articles
  }
}

// Handler for task detail endpoint (single task instance by ID)
async function handleTaskDetail(
  req: Request,
  user: AuthenticatedUser,
  taskInstanceId: string,
  supabase: any
): Promise<Response> {
  try {
    // Build the optimized query with all related data for a single task instance
    const { data: taskInstance, error: instanceError } = await supabase
      .from('task_instances')
      .select(`
        id,
        case_id,
        task_template_id,
        assigned_user_id,
        status,
        created_at,
        updated_at,
        cases!inner(
          id,
          deceased_name,
          date_of_death,
          created_at,
          case_users(
            user_id,
            profiles(
              id,
              name,
              email
            )
          )
        ),
        task_templates!inner(
          id,
          name,
          description,
          phase,
          timeframe,
          priority,
          can_delegate,
          contact_methods,
          required_documents,
          why_it_matters,
          human_insight,
          who_to_contact,
          how_to_find_contact,
          what_to_expect,
          suggested_professionals,
          what_success_looks_like,
          suggested_quantity,
          delegation_requirements,
          resources,
          downloadable_guides,
          pro_tips,
          related_task_ids,
          unlocks_other_steps,
          depends_on_task_id,
          task_template_articles(
            articles!inner(
              id,
              title,
              summary,
              content_url,
              read_time_min
            )
          )
        ),
        profiles!task_instances_assigned_user_id_fkey(
          id,
          name,
          email,
          role
        ),
        task_instance_steps(
          id,
          completed,
          completed_at,
          task_steps!inner(
            id,
            title,
            order,
            instructions,
            step_type,
            communication_helpers
          )
        ),
        notes(
          id,
          content,
          created_at,
          profiles!notes_author_id_fkey(
            id,
            name,
            email
          )
        )
      `)
      .eq('id', taskInstanceId)
      .single()

    if (instanceError) {
      console.error('Error fetching task instance:', instanceError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch task instance', details: instanceError.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    if (!taskInstance) {
      return new Response(
        JSON.stringify({ error: 'Task instance not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        },
      )
    }

    // Verify that the user has access to the case associated with this task instance
    if (user.role !== 'admin') {
      const { data: caseAccess, error: accessError } = await supabase
        .from('case_users')
        .select('id')
        .eq('case_id', taskInstance.case_id)
        .eq('user_id', user.id)
        .single()

      if (accessError || !caseAccess) {
        return new Response(
          JSON.stringify({ 
            error: 'Access denied: You do not have access to this task instance'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          },
        )
      }
    }

    // Transform the data
    const enrichedTaskInstance = transformTaskInstance(taskInstance)

    return new Response(
      JSON.stringify(enrichedTaskInstance),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in task detail handler:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
}

// Handler for task list endpoint (all task instances for a case)
async function handleTaskList(
  req: Request,
  user: AuthenticatedUser,
  supabase: any
): Promise<Response> {
  try {
    const url = new URL(req.url)
    const caseId = url.searchParams.get('case_id')
    const userId = url.searchParams.get('user_id') // For admin to filter by specific user

    // Validate required parameters
    if (!caseId) {
      return new Response(
        JSON.stringify({ error: 'case_id parameter is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // First, verify that the user has access to this case via the junction table
    if (user.role !== 'admin') {
      const { data: caseAccess, error: accessError } = await supabase
        .from('case_users')
        .select('id')
        .eq('case_id', caseId)
        .eq('user_id', user.id)
        .single()

      if (accessError || !caseAccess) {
        return new Response(
          JSON.stringify({ 
            error: 'Access denied: You do not have access to this case',
            task_instances: [],
            total_count: 0,
            user_id: user.id,
            case_id: caseId,
            filtered_by_user: userId || null
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          },
        )
      }
    }

    // Build the optimized query with all related data in a single query
    let query = supabase
      .from('task_instances')
      .select(`
        id,
        case_id,
        task_template_id,
        assigned_user_id,
        status,
        created_at,
        updated_at,
        cases!inner(
          id,
          deceased_name,
          date_of_death,
          created_at,
          case_users(
            user_id,
            profiles(
              id,
              name,
              email
            )
          )
        ),
        task_templates!inner(
          id,
          name,
          description,
          phase,
          timeframe,
          priority,
          can_delegate,
          contact_methods,
          required_documents,
          why_it_matters,
          human_insight,
          who_to_contact,
          how_to_find_contact,
          what_to_expect,
          suggested_professionals,
          what_success_looks_like,
          suggested_quantity,
          delegation_requirements,
          resources,
          downloadable_guides,
          pro_tips,
          related_task_ids,
          unlocks_other_steps,
          depends_on_task_id,
          task_template_articles(
            articles!inner(
              id,
              title,
              summary,
              content_url,
              read_time_min
            )
          )
        ),
        profiles!task_instances_assigned_user_id_fkey(
          id,
          name,
          email,
          role
        ),
        task_instance_steps(
          id,
          completed,
          completed_at,
          task_steps!inner(
            id,
            title,
            order,
            instructions,
            step_type,
            communication_helpers
          )
        ),
        notes(
          id,
          content,
          created_at,
          profiles!notes_author_id_fkey(
            id,
            name,
            email
          )
        )
      `)
      .eq('case_id', caseId)

    // Apply additional filters based on user role
    if (user.role === 'admin' && userId) {
      // Admins can see all task instances for the case
      // If user_id is provided, verify that user has access to this case
      const { data: userCaseAccess, error: userAccessError } = await supabase
        .from('case_users')
        .select('id')
        .eq('case_id', caseId)
        .eq('user_id', userId)
        .single()

      if (userAccessError || !userCaseAccess) {
        // The specified user doesn't have access to this case, return empty results
        return new Response(
          JSON.stringify({ 
            task_instances: [],
            total_count: 0,
            user_id: user.id,
            case_id: caseId,
            filtered_by_user: userId,
            message: `User ${userId} does not have access to this case`
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      }
    }
    // Regular users - access already verified above, so they can see all instances for this case

    // Execute the optimized query
    const { data: taskInstances, error: instancesError } = await query

    if (instancesError) {
      console.error('Error fetching task instances:', instancesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch task instances', details: instancesError.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    if (!taskInstances || taskInstances.length === 0) {
      return new Response(
        JSON.stringify({ 
          task_instances: [],
          total_count: 0,
          user_id: user.id,
          case_id: caseId,
          filtered_by_user: userId || null
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Transform the data efficiently
    const enrichedTaskInstances: TaskInstanceWithDetails[] = taskInstances.map(instance => 
      transformTaskInstance(instance)
    )

    // Calculate completion statistics efficiently
    const stats: TaskManagementStatistics = {
      total_instances: enrichedTaskInstances.length,
      pending: enrichedTaskInstances.filter(ti => ti.status === 'pending').length,
      in_progress: enrichedTaskInstances.filter(ti => ti.status === 'in_progress').length,
      done: enrichedTaskInstances.filter(ti => ti.status === 'done').length,
      total_steps: enrichedTaskInstances.reduce((sum, ti) => sum + ti.task_steps.length, 0),
      completed_steps: enrichedTaskInstances.reduce((sum, ti) => 
        sum + ti.task_steps.filter(step => step.completed).length, 0
      )
    }

    const response: TaskManagementResponse = {
      task_instances: enrichedTaskInstances,
      statistics: stats,
      user_id: user.id,
      user_role: user.role || 'user',
      case_id: caseId,
      filtered_by_user: userId || null,
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in task list handler:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
}

// Main handler function that requires authentication
async function handleRequest(req: Request, user: AuthenticatedUser): Promise<Response> {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    // Only allow GET method
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405,
        },
      )
    }

    // Log authenticated user access
    console.log(`Authenticated user ${user.id} (${user.email}) accessing task-management`)
    
    // Initialize Supabase client
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

    // Use URLPattern to match the detail endpoint
    // Path format: /functions/v1/task-management/{task_instance_id}
    // Similar to the example, match the function name and ID
    const taskDetailPattern = new URLPattern({ pathname: '/task-management/:id' })
    const matchingPath = taskDetailPattern.exec(req.url)
    const taskInstanceId = matchingPath ? matchingPath.pathname.groups.id : null

    // Route to appropriate handler based on whether we have an ID
    if (taskInstanceId) {
      // Detail request - single task instance by ID
      return await handleTaskDetail(req, user, taskInstanceId, supabase)
    } else {
      // List request - all task instances for a case
      return await handleTaskList(req, user, supabase)
    }

  } catch (error) {
    console.error('Error in task-management function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
}

// Export the function with authentication middleware
serve(withAuth(handleRequest))