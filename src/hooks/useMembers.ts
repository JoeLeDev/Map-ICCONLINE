import { useState, useEffect } from 'react';

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

  // Charger tous les membres
  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/members');
      if (!response.ok) throw new Error('Erreur lors du chargement');
      const data = await response.json();
      setMembers(data.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  // Ajouter un membre
  const addMember = async (memberData: Omit<Member, 'id' | 'createdAt'>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData)
      });
      if (!response.ok) throw new Error('Erreur lors de l\'ajout');
      const data = await response.json();
      setMembers(prev => [...prev, data.member]);
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
      setMembers(prev => prev.map(m => m.id === id ? data.member : m));
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
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Charger les membres au montage
  useEffect(() => {
    loadMembers();
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
