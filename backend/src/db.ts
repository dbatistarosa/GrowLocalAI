import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Executes a raw SQL query against the shared Turso database using the `team-db` CLI.
 * All mutations/queries are synchronized with Turso automatically.
 */
export async function query<T = any>(sql: string): Promise<T[]> {
  try {
    // Avoid shell injection issues by wrapping properly, although inside the team app we control the inputs.
    // team-db requires a single SQL statement passed as an argument.
    const escapedSql = sql.replace(/"/g, '\\"');
    const { stdout, stderr } = await execAsync(`team-db "${escapedSql}"`);

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
