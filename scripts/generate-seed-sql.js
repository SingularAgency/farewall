#!/usr/bin/env node

/**
 * Script to generate SQL seed file from tasks.json
 * This reads tasks.json and generates INSERT statements for task_templates and task_steps
 * Tasks are ordered by dependencies (tasks without dependsOn first)
 * Related tasks are converted from titles to task IDs
 */

const fs = require('fs');
const path = require('path');

// Read tasks.json
const tasksPath = path.join(__dirname, '..', 'tasks.json');
const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));

// Helper function to escape SQL strings
function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return "'" + String(str).replace(/'/g, "''").replace(/\\/g, '\\\\') + "'";
}

// Helper function to convert array to PostgreSQL array format
function toPgArray(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return 'NULL';
  return "ARRAY[" + arr.map(item => escapeSql(item)).join(', ') + "]";
}

// Helper function to convert array to PostgreSQL enum array format
function toPgEnumArray(arr, enumType) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return 'NULL';
  return "ARRAY[" + arr.map(item => escapeSql(item) + '::' + enumType).join(', ') + "]";
}

// Helper function to convert value to JSONB string (for communication helpers)
function toJsonb(value) {
  if (value === null || value === undefined) return 'NULL';
  return escapeSql(JSON.stringify(value));
}

// Create a map of task titles to task IDs
const titleToIdMap = {};
tasksData.tasks.forEach(task => {
  titleToIdMap[task.title] = task.id;
});

// Helper function to resolve task title to ID (with fuzzy matching)
function resolveTaskId(title) {
  if (!title) return null;
  
  // Exact match first
  if (titleToIdMap[title]) {
    return titleToIdMap[title];
  }
  
  // Try partial match (title starts with the search term)
  for (const [taskTitle, taskId] of Object.entries(titleToIdMap)) {
    if (taskTitle.startsWith(title) || title.startsWith(taskTitle)) {
      return taskId;
    }
  }
  
  // Try case-insensitive partial match
  const titleLower = title.toLowerCase();
  for (const [taskTitle, taskId] of Object.entries(titleToIdMap)) {
    if (taskTitle.toLowerCase().startsWith(titleLower) || titleLower.startsWith(taskTitle.toLowerCase())) {
      return taskId;
    }
  }
  
  // Special mappings for known mismatches
  const specialMappings = {
    'Begin Collecting Date-of-Death Statements': 'Begin Collecting Date-of-Death Account Statements',
    'Update Insurance Information': 'Update Insurance Information (Health, Auto, Home, Umbrella)',
    'Contact Financial Advisor': 'Contact Financial Advisor to Adjust Accounts and Cost Basis',
    'Cancel Non‑Essential Subscriptions': 'Cancel Non‑Essential Subscriptions and Memberships',
    'Notify Key Institutions': 'Notify Key Financial Institutions and Credit Bureaus',
    'Adjust Cost Basis': 'Contact Financial Advisor to Adjust Accounts and Cost Basis',
    'Obtain Real Estate Appraisals': 'Obtain Real Estate Appraisals for Date-of-Death Value',
    'File Estate Tax Return': 'File Estate Tax Return (Form 706)',
    'Contact Accountant or Tax Preparer': null // This task doesn't exist, skip it
  };
  
  if (specialMappings[title]) {
    const mappedTitle = specialMappings[title];
    if (mappedTitle && titleToIdMap[mappedTitle]) {
      return titleToIdMap[mappedTitle];
    }
  }
  
  console.warn(`⚠️  Warning: Could not find task ID for title: "${title}"`);
  return null;
}

// Helper function to resolve array of task titles to array of IDs
function resolveTaskIds(titles) {
  if (!titles || !Array.isArray(titles) || titles.length === 0) return null;
  return titles.map(title => resolveTaskId(title)).filter(id => id !== null);
}

// Sort tasks by dependencies (tasks with no dependsOn first)
function sortTasksByDependencies(tasks) {
  const taskMap = new Map();
  const visited = new Set();
  const result = [];
  
  // Create a map for quick lookup
  tasks.forEach(task => {
    taskMap.set(task.id, task);
  });
  
  // Helper function to visit a task and its dependencies
  function visit(taskId) {
    if (visited.has(taskId)) return;
    
    const task = taskMap.get(taskId);
    if (!task) return;
    
    // If this task depends on another task, visit that first
    if (task.dependsOn) {
      const dependsOnId = resolveTaskId(task.dependsOn);
      if (dependsOnId && taskMap.has(dependsOnId)) {
        visit(dependsOnId);
      }
    }
    
    visited.add(taskId);
    result.push(task);
  }
  
  // Visit all tasks
  tasks.forEach(task => {
    if (!visited.has(task.id)) {
      visit(task.id);
    }
  });
  
  return result;
}

// Helper function to build communication helpers JSONB object
function buildCommunicationHelpers(step) {
  // Steps are now always objects with a "type" field
  if (!step || typeof step !== 'object') {
    return null;
  }
  
  // Only action steps have communication helpers
  if (step.type !== 'action') {
    return null;
  }
  
  const helpers = {};
  if (step.contactMethod) helpers.contactMethod = step.contactMethod;
  if (step.phoneScript) helpers.phoneScript = step.phoneScript;
  if (step.emailTemplate) helpers.emailTemplate = step.emailTemplate;
  if (step.inPersonTalking) helpers.inPersonTalking = step.inPersonTalking;
  if (step.documentsNeeded) helpers.documentsNeeded = step.documentsNeeded;
  
  return Object.keys(helpers).length > 0 ? helpers : null;
}

// Sort tasks by dependencies
const sortedTasks = sortTasksByDependencies(tasksData.tasks);

// Generate SQL
let sql = `-- Seed task templates and steps from tasks.json
-- This file is auto-generated by scripts/generate-seed-sql.js
-- DO NOT EDIT MANUALLY - regenerate using: node scripts/generate-seed-sql.js
--
-- This seed file uses ON CONFLICT DO NOTHING to make it idempotent
-- You can run this multiple times without creating duplicates
-- Tasks are ordered by dependencies (tasks without dependsOn first)

-- Insert task templates (idempotent - will skip if template already exists)
`;

// Insert task templates with columns instead of JSONB
sortedTasks.forEach((task) => {
  const relatedTaskIds = resolveTaskIds(task.relatedTasks);
  const dependsOnTaskId = task.dependsOn ? resolveTaskId(task.dependsOn) : null;
  
  sql += `INSERT INTO task_templates (
  id, name, description, phase, timeframe, priority, can_delegate,
  contact_methods, required_documents, why_it_matters, human_insight,
  who_to_contact, how_to_find_contact, what_to_expect, suggested_professionals,
  what_success_looks_like, suggested_quantity, delegation_requirements,
  resources, downloadable_guides, pro_tips, related_task_ids,
  unlocks_other_steps, depends_on_task_id, created_at, updated_at
)
VALUES (
  ${escapeSql(task.id)}::uuid,
  ${escapeSql(task.title)},
  ${escapeSql(task.description)},
  ${escapeSql(task.phase)}::task_phase,
  ${escapeSql(task.timeframe)},
  ${escapeSql(task.priority)}::task_priority,
  ${task.canDelegate ? 'true' : 'false'},
  ${toPgEnumArray(task.contactMethods, 'contact_method')},
  ${toPgArray(task.requiredDocuments)},
  ${escapeSql(task.whyItMatters)},
  ${escapeSql(task.humanInsight)},
  ${escapeSql(task.whoToContact)},
  ${escapeSql(task.howToFindContact)},
  ${escapeSql(task.whatToExpect)},
  ${escapeSql(task.suggestedProfessionals)},
  ${escapeSql(task.whatSuccessLooksLike)},
  ${escapeSql(task.suggestedQuantity)},
  ${escapeSql(task.delegationRequirements)},
  ${toPgArray(task.resources)},
  ${toPgArray(task.downloadableGuides)},
  ${escapeSql(task.proTips)},
  ${relatedTaskIds ? "ARRAY[" + relatedTaskIds.map(id => escapeSql(id) + '::uuid').join(', ') + "]::uuid[]" : 'NULL'},
  ${task.unlocksOtherSteps ? 'true' : 'false'},
  ${dependsOnTaskId ? escapeSql(dependsOnTaskId) + '::uuid' : 'NULL'},
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;\n\n`;
});

// Insert task steps
sql += `-- Insert task steps\n\n`;

sortedTasks.forEach((task) => {
  task.steps.forEach((step, stepIndex) => {
    const stepOrder = stepIndex + 1;
    let title, instructions, stepType, communicationHelpers;
    
    // Steps are now always objects with a "type" field
    if (typeof step === 'string') {
      // Legacy support: if step is a string, treat it as instruction
      title = step;
      instructions = step;
      stepType = 'instruction';
      communicationHelpers = null;
    } else {
      // New structure: step has type and instruction
      stepType = step.type || 'instruction';
      title = step.instruction || step.title || `Step ${stepOrder}`;
      instructions = step.instruction || step.title || '';
      communicationHelpers = buildCommunicationHelpers(step);
    }
    
    sql += `INSERT INTO task_steps (task_template_id, title, "order", instructions, step_type, communication_helpers, created_at, updated_at)
VALUES (
  ${escapeSql(task.id)}::uuid,
  ${escapeSql(title)},
  ${stepOrder},
  ${escapeSql(instructions)},
  ${escapeSql(stepType)}::step_type,
  ${communicationHelpers ? toJsonb(communicationHelpers) + '::jsonb' : 'NULL'},
  NOW(),
  NOW()
);\n`;
  });
  sql += '\n';
});

// Write to seed.sql
const seedPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
fs.writeFileSync(seedPath, sql, 'utf8');

console.log(`✅ Generated seed.sql with ${sortedTasks.length} task templates (ordered by dependencies) and ${sortedTasks.reduce((sum, t) => sum + t.steps.length, 0)} task steps`);
console.log(`📝 File written to: ${seedPath}`);
console.log(`📊 Task creation order: ${sortedTasks.map(t => t.title.substring(0, 30)).join(' -> ')}`);
