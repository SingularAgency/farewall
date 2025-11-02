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
}

// Main handler function that requires authentication
async function handleRequest(req: Request, user: AuthenticatedUser): Promise<Response> {
  try {
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

    // Parse URL to get query parameters
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
    const enrichedTaskInstances: TaskInstanceWithDetails[] = taskInstances.map(instance => {
      // Sort task steps by order
      const sortedSteps = instance.task_instance_steps
        ?.sort((a, b) => a.task_steps.order - b.task_steps.order)
        ?.map(step => ({
          id: step.task_steps.id,
          title: step.task_steps.title,
          order: step.task_steps.order,
          instructions: step.task_steps.instructions,
          communication_helpers: step.task_steps.communication_helpers,
          completed: step.completed,
          completed_at: step.completed_at
        })) || []

      // Sort notes by creation date (newest first)
      const sortedNotes = instance.notes
        ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        ?.map(note => ({
          id: note.id,
          content: note.content,
          created_at: note.created_at,
          author: note.profiles
        })) || []

      // Extract articles from the nested structure
      const articles = instance.task_templates?.task_template_articles
        ?.map(templateArticle => templateArticle.articles) || []

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
    })

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