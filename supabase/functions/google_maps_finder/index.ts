import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { withAuth, AuthenticatedUser } from "../_shared/auth-middleware.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FUNERAL_SERVICE_CATEGORIES = {
  banks: {
    name: 'Banks & Financial Services',
    keywords: ['bank', 'credit union', 'financial services', 'mortgage', 'loan'],
    types: ['bank', 'finance']
  },
  funeral_homes: {
    name: 'Funeral Homes & Services',
    keywords: ['funeral home', 'crematory', 'memorial service', 'cemetery'],
    types: ['funeral_home', 'cemetery', 'crematory']
  },
  cremation_places: {
    name: 'Cremation Services',
    keywords: ['cremation', 'crematory', 'cremation service', 'cremation center'],
    types: ['crematory', 'funeral_home']
  },
  legal_services: {
    name: 'Legal Services',
    keywords: ['lawyer', 'attorney', 'legal services', 'estate planning', 'probate'],
    types: ['lawyer', 'attorney']
  },
  insurance: {
    name: 'Insurance Services',
    keywords: ['insurance', 'life insurance', 'estate planning'],
    types: ['insurance_agency']
  },
  government_services: {
    name: 'Government Services',
    keywords: ['social security', 'vital records', 'death certificate', 'government office', 'department of motor vehicles', 'dmv'],
    types: ['local_government_office', 'post_office', 'government_office']
  },
  cemeteries: {
    name: 'Cemeteries & Mausoleums',
    keywords: ['cemetery', 'mausoleum', 'burial ground', 'memorial park', 'graveyard'],
    types: ['cemetery', 'place_of_worship']
  },
  counseling: {
    name: 'Counseling & Support',
    keywords: ['counseling', 'grief support', 'therapy', 'mental health'],
    types: ['health', 'hospital']
  }
}


interface SearchRequest {
  location: string
  category: keyof typeof FUNERAL_SERVICE_CATEGORIES
  radius?: number
  limit?: number
}

// Main handler function that requires authentication
async function handleRequest(req: Request, user: AuthenticatedUser): Promise<Response> {
  try {
    // Log authenticated user access
    console.log(`Authenticated user ${user.id} (${user.email}) accessing google-maps-finder`)
    
    const { location, category, radius = 5000, limit = 20 }: SearchRequest = await req.json()

    if (!location || !category) {
      return new Response(
        JSON.stringify({ error: 'Location and category are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    if (!FUNERAL_SERVICE_CATEGORIES[category]) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid category',
          available_categories: Object.keys(FUNERAL_SERVICE_CATEGORIES)
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!googleMapsApiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    const serviceCategory = FUNERAL_SERVICE_CATEGORIES[category]
    const results: any[] = []

    // Search for each type in the category
    for (const type of serviceCategory.types) {
      const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
      searchUrl.searchParams.set('query', `${type} near ${location}`)
      searchUrl.searchParams.set('key', googleMapsApiKey)
      searchUrl.searchParams.set('radius', radius.toString())
      searchUrl.searchParams.set('type', type)

      const response = await fetch(searchUrl.toString())
      const data = await response.json()

      if (data.status === 'OK' && data.results) {
        // Process each place and fetch detailed information
        for (const place of data.results) {
          try {
            // Fetch detailed place information including opening hours, phone, and website
            const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json')
            detailsUrl.searchParams.set('place_id', place.place_id)
            detailsUrl.searchParams.set('key', googleMapsApiKey)
            detailsUrl.searchParams.set('fields', 'place_id,name,formatted_address,rating,price_level,types,geometry,business_status,opening_hours,formatted_phone_number,international_phone_number,website,url')

            const detailsResponse = await fetch(detailsUrl.toString())
            const detailsData = await detailsResponse.json()

            if (detailsData.status === 'OK' && detailsData.result) {
              const placeDetails = detailsData.result
              
              // Format opening hours
              let openingHours: any = null
              if (placeDetails.opening_hours && placeDetails.opening_hours.weekday_text) {
                openingHours = {
                  open_now: placeDetails.opening_hours.open_now,
                  weekday_text: placeDetails.opening_hours.weekday_text,
                  periods: placeDetails.opening_hours.periods || null
                }
              }

              results.push({
                id: place.place_id,
                name: place.name,
                address: place.formatted_address,
                rating: place.rating,
                price_level: place.price_level,
                types: place.types,
                geometry: place.geometry,
                business_status: place.business_status,
                category: category,
                category_name: serviceCategory.name,
                // New fields
                phone_number: placeDetails.formatted_phone_number || placeDetails.international_phone_number || null,
                website: placeDetails.website || null,
                google_maps_url: placeDetails.url || null,
                opening_hours: openingHours
              })
            } else {
              // Fallback to basic information if details fetch fails
              results.push({
                id: place.place_id,
                name: place.name,
                address: place.formatted_address,
                rating: place.rating,
                price_level: place.price_level,
                types: place.types,
                geometry: place.geometry,
                business_status: place.business_status,
                category: category,
                category_name: serviceCategory.name,
                phone_number: null,
                website: null,
                google_maps_url: null,
                opening_hours: null
              })
            }
          } catch (detailError) {
            console.error(`Error fetching details for place ${place.place_id}:`, detailError)
            // Fallback to basic information
            results.push({
              id: place.place_id,
              name: place.name,
              address: place.formatted_address,
              rating: place.rating,
              price_level: place.price_level,
              types: place.types,
              geometry: place.geometry,
              business_status: place.business_status,
              category: category,
              category_name: serviceCategory.name,
              phone_number: null,
              website: null,
              google_maps_url: null,
              opening_hours: null
            })
          }
        }
      }
    }

    // Remove duplicates and sort by rating
    const uniqueResults = results
      .filter((place, index, self) => 
        index === self.findIndex(p => p.id === place.id)
      )
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, limit)

    return new Response(
      JSON.stringify({
        category: category,
        category_name: serviceCategory.name,
        location: location,
        results: uniqueResults,
        total_found: uniqueResults.length,
        user_id: user.id, // Include user ID in response for tracking
        search_timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in google-maps-finder function:', error)
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

