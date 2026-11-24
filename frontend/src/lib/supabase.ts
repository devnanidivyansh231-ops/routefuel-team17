import { createClient } from "@supabase/supabase-js";

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

const hasProjectSettings = Boolean(
  projectUrl &&
  publicKey &&
  !projectUrl.includes("your-project-ref") &&
  !publicKey.includes("replace_with_your_public_key"),
);

export const supabase =
  hasProjectSettings ? createClient(projectUrl!, publicKey!) : null;

export const backendReady = supabase !== null;
