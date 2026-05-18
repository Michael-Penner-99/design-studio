export type {
  NewRunInput,
  JobSpec,
  RunStatus,
  PhaseStatus,
} from "./schemas";

export interface RunSummary {
  run_id: string;
  slug: string | null;
  mode: "url" | "name-and-reviews";
  status: "queued" | "running" | "completed" | "halted";
  current_phase: number | null;
  started_at: string;
  updated_at: string | null;
  url: string | null;
  business_name: string | null;
}
