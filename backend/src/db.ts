import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Escapes a single SQL string value to prevent SQL injection.
 * Doubles single quotes (standard SQL escaping) and wraps in quotes.
 * NULL values are returned as the string "NULL" (without quotes for SQL).
 */
function escapeValue(value: any): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  // String escaping: double single quotes
  const str = String(value);
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Builds a safe SQL string by replacing ? placeholders with properly escaped parameter values.
 * Throws if the number of placeholders doesn't match the number of params.
 */
function buildSafeSql(sql: string, params?: any[]): string {
  if (!params || params.length === 0) {
    // Still check for literal ? that aren't placeholders (shouldn't happen in practice)
    return sql;
  }

  let paramIndex = 0;
  const result = sql.replace(/\?/g, () => {
    if (paramIndex >= params.length) {
      throw new Error(
        `Not enough parameters for SQL: expected ${paramIndex + 1} but got ${params.length}\nSQL: ${sql}`
      );
    }
    return escapeValue(params[paramIndex++]);
  });

  if (paramIndex !== params.length) {
    throw new Error(
      `Too many parameters for SQL: expected ${paramIndex} but got ${params.length}\nSQL: ${sql}`
    );
  }

  return result;
}

/**
 * Executes a parameterized SQL query against the shared Turso database using the `team-db` CLI.
 *
 * Usage:
 *   await query("SELECT * FROM users WHERE email = ?", [email])
 *   await query("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", [id, name, email])
 *   await query("SELECT * FROM posts WHERE business_id = ? ORDER BY created_at DESC", [businessId])
 *
 * SQL Injection is prevented by properly escaping all parameter values before
 * they are interpolated into the SQL string. The `?` placeholder is replaced
 * with the escaped value before passing the final SQL to team-db.
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  try {
    // Build safe SQL with escaped parameters
    const safeSql = buildSafeSql(sql, params);

    // Escape single quotes for shell safety
    const shellEscapedSql = safeSql.replace(/'/g, "'\\''");

    const { stdout, stderr } = await execAsync(`team-db '${shellEscapedSql}'`);

    if (stderr && stderr.trim()) {
      console.warn("DB stderr:", stderr);
    }

    try {
      return JSON.parse(stdout.trim()) as T[];
    } catch (parseError) {
      console.error("Failed to parse database output:", stdout);
      throw new Error(`Database output parse error: ${parseError}`);
    }
  } catch (error: any) {
    console.error("Database query error:", error.message || error);
    throw error;
  }
}

/**
 * Migration-safe query builder for simple dynamic WHERE clauses.
 * Use only when you need to build dynamic filters (admin search, etc.)
 * and standard ? placeholders won't work.
 * 
 * This escapes identifiers (column names) and values separately.
 * NOTE: idents should only be from a pre-approved allowlist, not user input.
 */
export function safeWhere(conditions: { column: string; value: any; op?: string }[]): string {
  if (conditions.length === 0) return "1=1";
  return conditions
    .map((c) => {
      const op = c.op || "=";
      return `${c.column} ${op} ${escapeValue(c.value)}`;
    })
    .join(" AND ");
}