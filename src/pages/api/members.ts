import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

// GET - Récupérer tous les membres
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { data: members, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur Supabase:', error);
        return res.status(500).json({ error: 'Erreur lors du chargement des membres' });
      }

      res.status(200).json({ members: members || [] });
      return;
    } catch (error) {
      console.error('Erreur API:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { data: newMember, error } = await supabase
        .from('members')
        .insert([{
          name: req.body.name,
          latitude: req.body.latitude,
          longitude: req.body.longitude,
          address: req.body.address,
          description: req.body.description || '',
          poste: req.body.poste || '',
          ville: req.body.ville || '',
          pays: req.body.pays || ''
        }])
        .select()
        .single();

      if (error) {
        console.error('Erreur Supabase:', error);
        return res.status(500).json({ error: 'Erreur lors de l\'ajout du membre' });
      }

      res.status(201).json({ member: newMember });
      return;
    } catch (error) {
      console.error('Erreur API:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      
      const { data: updatedMember, error } = await supabase
        .from('members')
        .update({
          name: req.body.name,
          latitude: req.body.latitude,
          longitude: req.body.longitude,
          address: req.body.address,
          description: req.body.description,
          poste: req.body.poste,
          ville: req.body.ville,
          pays: req.body.pays,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erreur Supabase:', error);
        return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
      }

      if (!updatedMember) {
        return res.status(404).json({ error: 'Membre non trouvé' });
      }

      res.status(200).json({ member: updatedMember });
      return;
    } catch (error) {
      console.error('Erreur API:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erreur Supabase:', error);
        return res.status(500).json({ error: 'Erreur lors de la suppression' });
      }

      res.status(200).json({ message: 'Membre supprimé' });
      return;
    } catch (error) {
      console.error('Erreur API:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

