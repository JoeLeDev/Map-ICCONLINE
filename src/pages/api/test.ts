import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    message: 'API fonctionne',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configuré' : 'Manquant',
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Configuré' : 'Manquant',
    timestamp: new Date().toISOString()
  });
}
