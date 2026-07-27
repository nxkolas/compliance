import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getPublicSupabaseEnvironment } from "@/src/config/env/supabase";

/**
 * Merges conditional class names and resolves Tailwind conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Indicates whether the public Supabase configuration required by auth flows is present.
 */
export const hasEnvVars = hasSupabaseEnvironment();

function hasSupabaseEnvironment() {
  try {
    getPublicSupabaseEnvironment();
    return true;
  } catch {
    return false;
  }
}
