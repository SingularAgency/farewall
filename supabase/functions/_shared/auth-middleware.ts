import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export interface AuthenticatedUser {
  id: string
  email?: string
  role?: string
  user_metadata?: any
}

export interface AuthResult {
  success: boolean
  user?: AuthenticatedUser
  error?: string
  response?: Response
}

/**
 * Authentication middleware for Supabase Edge Functions
 * Validates JWT token and returns user information
 */
export async function authenticateUser(req: Request): Promise<AuthResult> {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return {
        success: true,
        response: new Response('ok', { headers: corsHeaders })
      }
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return {
        success: false,
        error: 'Authorization header is required',
        response: new Response(
          JSON.stringify({ error: 'Authorization header is required' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          },
        )
      }
    }

    // Extract the token from the Bearer format
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return {
        success: false,
        error: 'Invalid authorization format',
        response: new Response(
          JSON.stringify({ error: 'Invalid authorization format' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          },
        )
      }
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        success: false,
        error: 'Supabase configuration missing',
        response: new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          },
        )
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return {
        success: false,
        error: 'Invalid or expired token',
        response: new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          },
        )
      }
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        user_metadata: user.user_metadata
      }
    }

  } catch (error) {
    console.error('Authentication error:', error)
    return {
      success: false,
      error: 'Authentication failed',
      response: new Response(
        JSON.stringify({ error: 'Authentication failed', details: error.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }
  }
}

/**
 * Higher-order function that wraps an endpoint with authentication
 * Usage: export default withAuth(yourEndpointFunction)
 */
export function withAuth(handler: (req: Request, user: AuthenticatedUser) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const authResult = await authenticateUser(req)
    
    // If authentication failed, return the error response
    if (!authResult.success) {
      return authResult.response!
    }

    // If it's a CORS preflight, return early
    if (req.method === 'OPTIONS') {
      return authResult.response!
    }

    // Call the original handler with the authenticated user
    return handler(req, authResult.user!)
  }
}
