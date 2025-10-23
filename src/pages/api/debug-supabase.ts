import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('🔍 Test de connexion Supabase...');
    
    // Test 1: Vérifier la connexion de base
    const { data: testData, error: testError } = await supabase
      .from('members')
      .select('count')
      .limit(1);
    
    console.log('Test 1 - Connexion:', { testData, testError });
    
    // Test 2: Essayer de récupérer tous les membres
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('*')
      .limit(5);
    
    console.log('Test 2 - Membres:', { members, membersError });
    
    // Test 3: Vérifier la structure de la table
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'members' })
      .limit(1);
    
    console.log('Test 3 - Structure table:', { tableInfo, tableError });
    
    res.status(200).json({
      message: 'Debug Supabase',
      test1: { testData, testError },
      test2: { members, membersError },
      test3: { tableInfo, tableError },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erreur debug:', error);
    res.status(500).json({ 
      error: 'Erreur debug', 
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
