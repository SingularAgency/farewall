import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { withAuth, AuthenticatedUser } from "../_shared/auth-middleware.ts"
import { Case } from "../_shared/task-management/types.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

interface CasesResponse {
  cases: Case[]
  total_count: number
  user_id: string
  user_role: string
  filtered_by_user: string | null
  timestamp: string
}

async function handleRequest(req: Request, user: AuthenticatedUser): Promise<Response> {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders })
    }

    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405,
        },
      )
    }

    console.log(`Authenticated user ${user.id} (${user.email}) accessing cases`)

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const filterUserId = url.searchParams.get("user_id")
    const limitParam = url.searchParams.get("limit")
    const offsetParam = url.searchParams.get("offset")
    const searchParam = url.searchParams.get("search")

    let effectiveFilterUserId = filterUserId

    if (user.role !== "admin") {
      if (filterUserId && filterUserId !== user.id) {
        return new Response(
          JSON.stringify({ error: "Access denied: You can only view your own cases" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 403,
          },
        )
      }

      effectiveFilterUserId = user.id
    }

    let caseIdsFilter: string[] | null = null

    if (effectiveFilterUserId) {
      const { data: caseLinks, error: caseLinksError } = await supabase
        .from("case_users")
        .select("case_id")
        .eq("user_id", effectiveFilterUserId)

      if (caseLinksError) {
        console.error("Error fetching case access list:", caseLinksError)
        return new Response(
          JSON.stringify({ error: "Failed to fetch cases", details: caseLinksError.message }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          },
        )
      }

      caseIdsFilter = (caseLinks || []).map(link => link.case_id)

      if (caseIdsFilter.length === 0) {
        const emptyResponse: CasesResponse = {
          cases: [],
          total_count: 0,
          user_id: user.id,
          user_role: user.role || "user",
          filtered_by_user: effectiveFilterUserId,
          timestamp: new Date().toISOString(),
        }

        return new Response(
          JSON.stringify(emptyResponse),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        )
      }
    }

    let query = supabase
      .from("cases")
      .select(`
        id,
        deceased_name,
        date_of_death,
        created_at,
        updated_at,
        case_users(
          user_id,
          profiles(
            id,
            name,
            email,
            role
          )
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false })

    if (caseIdsFilter) {
      query = query.in("id", caseIdsFilter)
    }

    if (searchParam) {
      query = query.ilike("deceased_name", `%${searchParam}%`)
    }

    let limitNum: number | null = null
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limitNum = parsedLimit
        query = query.limit(parsedLimit)
      }
    }

    if (offsetParam) {
      const offsetNum = parseInt(offsetParam, 10)
      if (!isNaN(offsetNum) && offsetNum >= 0) {
        const rangeEnd = limitNum ? offsetNum + (limitNum - 1) : offsetNum + 49
        query = query.range(offsetNum, rangeEnd)
      }
    }

    const { data: cases, error: casesError, count } = await query

    if (casesError) {
      console.error("Error fetching cases:", casesError)
      return new Response(
        JSON.stringify({ error: "Failed to fetch cases", details: casesError.message }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      )
    }

    const response: CasesResponse = {
      cases: cases || [],
      total_count: typeof count === "number" ? count : (cases?.length ?? 0),
      user_id: user.id,
      user_role: user.role || "user",
      filtered_by_user: effectiveFilterUserId,
      timestamp: new Date().toISOString(),
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("Error in cases function:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    )
  }
}

serve(withAuth(handleRequest))

