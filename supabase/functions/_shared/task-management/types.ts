/**
 * Type definitions for the Task & Case Management System
 * 
 * This file contains all interfaces and types used across the edge functions
 * for consistent data structures and type safety.
 */

// ============================================================================
// USER & AUTHENTICATION INTERFACES
// ============================================================================

export interface AuthenticatedUser {
  id: string
  email?: string
  role?: string
  user_metadata?: any
}

export interface UserProfile {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'executor'
  created_at: string
  updated_at: string
}

// ============================================================================
// CASE MANAGEMENT INTERFACES
// ============================================================================

export interface Case {
  id: string
  deceased_name: string | null
  date_of_death: string | null
  created_at: string
  updated_at: string
  case_users?: Array<{
    user_id: string
    profiles?: {
      id: string
      name: string
      email: string
    }
  }>
}

export interface CaseUser {
  id: string
  case_id: string
  user_id: string
  created_at: string
}

// ============================================================================
// TASK TEMPLATE INTERFACES
// ============================================================================

export interface TaskTemplate {
  id: string
  name: string
  description: string
  phase: 'immediately' | 'first-month' | 'months-2-3' | 'months-3-6' | 'beyond' | null
  timeframe: string | null
  priority: 'high' | 'medium' | 'low' | null
  can_delegate: boolean
  contact_methods: string[] | null
  required_documents: string[] | null
  why_it_matters: string | null
  human_insight: string | null
  who_to_contact: string | null
  how_to_find_contact: string | null
  what_to_expect: string | null
  suggested_professionals: string | null
  what_success_looks_like: string | null
  suggested_quantity: string | null
  delegation_requirements: string | null
  resources: string[] | null
  downloadable_guides: string[] | null
  pro_tips: string | null
  related_task_ids: string[] | null
  unlocks_other_steps: boolean
  depends_on_task_id: string | null
  created_at: string
  updated_at: string
}

export interface TaskStep {
  id: string
  task_template_id: string
  title: string
  order: number
  instructions: string | null
  step_type: 'action' | 'instruction'
  communication_helpers: Record<string, any> | null
  created_at: string
  updated_at: string
}

// ============================================================================
// TASK INSTANCE INTERFACES
// ============================================================================

export type TaskInstanceStatus = 'pending' | 'in_progress' | 'done'

export interface TaskInstance {
  id: string
  case_id: string
  task_template_id: string
  assigned_user_id: string
  status: TaskInstanceStatus
  created_at: string
  updated_at: string
}

export interface TaskInstanceStep {
  id: string
  task_instance_id: string
  task_step_id: string
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// ARTICLE INTERFACES
// ============================================================================

export interface Article {
  id: string
  title: string
  summary: string
  content_url: string
  read_time_min: number
  created_at: string
  updated_at: string
}

export interface TaskTemplateArticle {
  task_template_id: string
  article_id: string
  created_at: string
}

// ============================================================================
// NOTE INTERFACES
// ============================================================================

export interface Note {
  id: string
  task_instance_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface Attachment {
  id: string
  note_id: string
  file_url: string
  file_name: string
  created_at: string
}

// ============================================================================
// COMPOSITE INTERFACES (with related data)
// ============================================================================

export interface TaskInstanceWithDetails {
  id: string
  case_id: string
  task_template_id: string
  assigned_user_id: string
  status: TaskInstanceStatus
  created_at: string
  updated_at: string
  // Related data
  case: Case
  task_template: TaskTemplate
  assigned_user: UserProfile
  task_steps: Array<TaskStepWithCompletion>
  notes: Array<NoteWithAuthor>
  articles: Array<Article>
}

export interface TaskStepWithCompletion {
  id: string
  title: string
  order: number
  instructions: string | null
  step_type: 'action' | 'instruction'
  communication_helpers: Record<string, any> | null
  completed: boolean
  completed_at: string | null
}

export interface NoteWithAuthor {
  id: string
  content: string
  created_at: string
  author: {
    id: string
    name: string
    email: string
  }
}

export interface ArticleWithTemplate {
  id: string
  title: string
  summary: string
  content_url: string
  read_time_min: number
  task_template_id: string
}

// ============================================================================
// API REQUEST/RESPONSE INTERFACES
// ============================================================================

export interface TaskManagementStatistics {
  total_instances: number
  pending: number
  in_progress: number
  done: number
  total_steps: number
  completed_steps: number
}

export interface TaskManagementResponse {
  task_instances: TaskInstanceWithDetails[]
  statistics: TaskManagementStatistics
  user_id: string
  user_role: string
  case_id: string
  filtered_by_user: string | null
  timestamp: string
}

// ============================================================================
// ERROR INTERFACES
// ============================================================================

export interface ApiError {
  error: string
  details?: string
  code?: string
}

export interface ValidationError extends ApiError {
  field: string
  value: any
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DatabaseTable = 
  | 'profiles'
  | 'cases'
  | 'task_templates'
  | 'task_steps'
  | 'task_instances'
  | 'task_instance_steps'
  | 'articles'
  | 'task_template_articles'
  | 'notes'
  | 'attachments'

export type UserRole = 'admin' | 'user' | 'executor'

export type SortOrder = 'asc' | 'desc'

export interface PaginationParams {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: SortOrder
}
