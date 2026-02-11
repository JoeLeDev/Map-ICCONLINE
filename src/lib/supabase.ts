import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Interface pour les membres
export interface Member {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  description: string;
  poste: string;
  ville: string;
  pays: string;
  created_at: string;
  updated_at: string;
}
