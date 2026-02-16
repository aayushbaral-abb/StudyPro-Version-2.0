
import { createClient } from '@supabase/supabase-js';

// Vite uses import.meta.env for environment variables.
// We use optional chaining here because in some runtime environments import.meta.env might be undefined.
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://rbkgdzqytqpcfezryxpg.supabase.co';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJia2dkenF5dHFwY2ZlenJ5eHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMjY1OTksImV4cCI6MjA4MTkwMjU5OX0.VXVh4n-T8a9pXHi1myqNwNCjRdxrR5X8cXaqrD8K0lE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
