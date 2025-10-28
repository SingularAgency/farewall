import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withAuth, AuthenticatedUser } from "../_shared/auth-middleware.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Article interface
interface Article {
  id: string
  title: string
  summary: string | null
  content_url: string
  read_time_min: number | null
  created_at: string
  updated_at: string
}

interface ArticlesResponse {
  articles: Article[]
  total_count: number
  user_id: string
  user_role: string
  timestamp: string
}

// Main handler function that requires authentication
async function handleRequest(req: Request, user: AuthenticatedUser): Promise<Response> {
  try {
    // Log authenticated user access
    console.log(`Authenticated user ${user.id} (${user.email}) accessing articles`)
    
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
    const search = url.searchParams.get('search') // Optional search by title/summary
    const limit = url.searchParams.get('limit') // Optional limit
    const offset = url.searchParams.get('offset') // Optional offset for pagination

    // Build the query
    let query = supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply search filter if provided
    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`)
    }

    // Apply pagination if provided
    if (limit) {
      const limitNum = parseInt(limit, 10)
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum)
      }
    }

    if (offset) {
      const offsetNum = parseInt(offset, 10)
      if (!isNaN(offsetNum) && offsetNum >= 0) {
        query = query.range(offsetNum, offsetNum + (parseInt(limit || '50', 10) - 1))
      }
    }

    // Execute the query
    const { data: articles, error: articlesError, count } = await query

    if (articlesError) {
      console.error('Error fetching articles:', articlesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch articles', details: articlesError.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    const response: ArticlesResponse = {
      articles: articles || [],
      total_count: count || 0,
      user_id: user.id,
      user_role: user.role || 'user',
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
    console.error('Error in articles function:', error)
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
