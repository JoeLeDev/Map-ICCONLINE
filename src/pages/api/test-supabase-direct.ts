import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Test direct avec fetch vers Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('🔍 Variables d\'environnement:');
    console.log('URL:', supabaseUrl);
    console.log('Key (premiers 20 chars):', supabaseKey?.substring(0, 20) + '...');
    
    // Test 1: Appel direct à l'API Supabase
    const response = await fetch(`${supabaseUrl}/rest/v1/members?select=count`, {
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Réponse Supabase:');
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Body:', responseText);
    
    if (!response.ok) {
      return res.status(500).json({
        error: 'Erreur Supabase directe',
        status: response.status,
        body: responseText,
        url: supabaseUrl,
        keyPrefix: supabaseKey?.substring(0, 20)
      });
    }
    
    res.status(200).json({
      message: 'Connexion Supabase réussie',
      status: response.status,
      data: responseText,
      url: supabaseUrl,
      keyPrefix: supabaseKey?.substring(0, 20)
    });
    
  } catch (error) {
    console.error('Erreur test direct:', error);
    res.status(500).json({
      error: 'Erreur test direct',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
