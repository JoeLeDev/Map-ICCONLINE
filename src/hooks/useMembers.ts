import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

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

export const useMembers = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

  // Charger tous les membres depuis Supabase
  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;
      // Log pour debug - voir les données récupérées
      console.log('📊 Membres récupérés depuis Supabase:', data?.map(m => ({
        id: m.id,
        name: m.name,
        address: m.address,
        description: m.description
      })));
      setMembers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  // Ajouter un membre
  const addMember = async (memberData: Omit<Member, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Member, 'created_at' | 'updated_at'>>) => {
    setLoading(true);
    setError(null);
    try {
      // Ne pas envoyer created_at et updated_at car Supabase les génère automatiquement
      const { created_at, updated_at, ...dataToSend } = memberData;
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });
      if (!response.ok) throw new Error('Erreur lors de l\'ajout');
      const data = await response.json();
      // La subscription mettra à jour automatiquement l'état
      return data.member;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour un membre
  const updateMember = async (id: string, memberData: Partial<Member>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/members?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData)
      });
      if (!response.ok) throw new Error('Erreur lors de la mise à jour');
      const data = await response.json();
      // La subscription mettra à jour automatiquement l'état
      return data.member;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Supprimer un membre
  const deleteMember = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/members?id=${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Erreur lors de la suppression');
      // La subscription mettra à jour automatiquement l'état
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Charger les membres et configurer la subscription en temps réel
  useEffect(() => {
    // Charger les membres au montage
    loadMembers();

    // Configurer la subscription Supabase en temps réel
    const subscription = supabase
      .channel('members-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Écouter tous les événements (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'members'
        },
        (payload) => {
          console.log('🔄 Changement détecté dans la base de données:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            // Nouveau membre ajouté
            setMembers((prev) => [payload.new as Member, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            // Membre mis à jour
            setMembers((prev) =>
              prev.map((member) =>
                member.id === payload.new.id ? (payload.new as Member) : member
              )
            );
          } else if (payload.eventType === 'DELETE') {
            // Membre supprimé
            setMembers((prev) => prev.filter((member) => member.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscription Supabase active - Mises à jour en temps réel activées');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erreur de subscription Supabase');
          setError('Erreur de connexion en temps réel');
        }
      });

    subscriptionRef.current = subscription;

    // Nettoyer la subscription au démontage
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        console.log('🔌 Subscription Supabase fermée');
      }
    };
  }, []);

  return {
    members,
    loading,
    error,
    loadMembers,
    addMember,
    updateMember,
    deleteMember
  };
};
