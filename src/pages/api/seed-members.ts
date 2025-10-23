import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Données de test
    const testMembers = [
      {
        name: "Jean Dupont",
        latitude: 48.8566,
        longitude: 2.3522,
        address: "1 Rue de Rivoli, 75001 Paris, France",
        description: "Membre fondateur",
        poste: "Président",
        ville: "Paris",
        pays: "France"
      },
      {
        name: "Marie Martin",
        latitude: 45.7640,
        longitude: 4.8357,
        address: "Place Bellecour, 69002 Lyon, France",
        description: "Responsable communication",
        poste: "Communication",
        ville: "Lyon",
        pays: "France"
      },
      {
        name: "Pierre Durand",
        latitude: 43.2965,
        longitude: 5.3698,
        address: "Vieux Port, 13001 Marseille, France",
        description: "Coordinateur régional",
        poste: "Coordinateur",
        ville: "Marseille",
        pays: "France"
      }
    ];

    // Insérer les membres de test
    const { data, error } = await supabase
      .from('members')
      .insert(testMembers)
      .select();

    if (error) {
      console.error('Erreur Supabase:', error);
      return res.status(500).json({ 
        error: 'Erreur lors de l\'ajout des membres de test',
        details: error.message 
      });
    }

    res.status(200).json({ 
      message: 'Membres de test ajoutés avec succès',
      members: data,
      count: data.length
    });

  } catch (error) {
    console.error('Erreur API:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
