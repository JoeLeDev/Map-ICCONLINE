import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  // Statut Realtime séparé de l'erreur de chargement : une déconnexion WebSocket
  // ne doit pas faire disparaître la carte si on a déjà des données en mémoire.
  const [realtimeStatus, setRealtimeStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('connecting');
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  // Compteur de tentatives pour le back-off exponentiel de reconnexion Realtime.
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fonction pour nettoyer et normaliser les données d'un membre
  const cleanMemberData = (member: Member): Member => {
    let cleanedAddress = member.address || '';
    let cleanedDescription = member.description || '';

    // Si on a les champs ville et pays, construire l'adresse correctement
    if (member.ville || member.pays) {
      const addressParts: string[] = [];
      if (member.ville) addressParts.push(member.ville);
      if (member.pays) addressParts.push(member.pays);
      cleanedAddress = addressParts.join(' ');
    }

    // Nettoyer la description : ne garder que "Poste: ..." et retirer ville/pays si présents
    if (cleanedDescription) {
      // Extraire seulement la partie "Poste: ..."
      const posteMatch = cleanedDescription.match(/Poste:\s*([^\n]+)/);
      if (posteMatch) {
        cleanedDescription = `Poste: ${posteMatch[1].trim()}`;
      } else {
        // Si pas de format "Poste: ...", garder la description telle quelle mais retirer les lignes Ville/Pays
        cleanedDescription = cleanedDescription
          .split('\n')
          .filter(line => !line.match(/^(Ville|Pays):/i))
          .join('\n')
          .trim();
      }
    }

    return {
      ...member,
      address: cleanedAddress,
      description: cleanedDescription
    };
  };

  // Charger tous les membres depuis Supabase
  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Forcer un rechargement sans cache en ajoutant un timestamp
      const timestamp = Date.now();
      console.log(`🔄 Rechargement des membres (timestamp: ${timestamp})...`);
      
      const { data, error: supabaseError } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;
      
      // Log détaillé pour debug - voir les données récupérées
      console.log('📊 Membres récupérés depuis Supabase:', data?.length || 0, 'membres');
      console.log('📋 Détails des premiers membres:', data?.slice(0, 3).map(m => ({
        id: m.id,
        name: m.name,
        address: m.address,
        description: m.description,
        poste: m.poste,
        ville: m.ville,
        pays: m.pays
      })));
      
      // Nettoyer et normaliser les données de tous les membres
      const cleanedData = data?.map(member => cleanMemberData(member)) || [];
      
      // Log après nettoyage
      console.log('🧹 Données nettoyées - Exemples:', cleanedData.slice(0, 3).map(m => ({
        name: m.name,
        address: m.address,
        description: m.description
      })));
      
      setMembers(cleanedData);
      console.log('✅ Membres chargés avec succès');
    } catch (err) {
      console.error('❌ Erreur lors du chargement:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  // Ajouter un membre
  const addMember = async (memberData: Omit<Member, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Member, 'created_at' | 'updated_at'>>) => {
    setLoading(true);
    setError(null);
    try {
      // Ne pas envoyer created_at et updated_at car Supabase les génère automatiquement
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    let isMounted = true;

    const cleanupSubscription = () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };

    const setupSubscription = () => {
      cleanupSubscription();

      // Nom de canal unique par tentative pour éviter les conflits côté Supabase
      // lors d'une reconnexion rapide.
      const channelName = `members-changes-${Date.now()}`;
      const subscription = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'members'
          },
          (payload) => {
            console.log('🔄 Changement détecté dans la base de données:', payload.eventType);

            if (payload.eventType === 'INSERT') {
              const cleanedMember = cleanMemberData(payload.new as Member);
              setMembers((prev) => [cleanedMember, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              const cleanedMember = cleanMemberData(payload.new as Member);
              setMembers((prev) =>
                prev.map((member) =>
                  member.id === cleanedMember.id ? cleanedMember : member
                )
              );
            } else if (payload.eventType === 'DELETE') {
              setMembers((prev) => prev.filter((member) => member.id !== payload.old.id));
            }
          }
        )
        .subscribe((status) => {
          if (!isMounted) return;

          if (status === 'SUBSCRIBED') {
            console.log('✅ Subscription Supabase active - Temps réel activé');
            setRealtimeStatus('connected');
            reconnectAttemptsRef.current = 0;
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            // Important : on NE met PAS `error` ici. La carte reste affichée
            // avec les dernières données chargées. On tente une reconnexion
            // automatique en back-off exponentiel (max 30 s).
            console.warn(
              `⚠️ Canal Realtime perdu (${status}). Reconnexion automatique...`
            );
            setRealtimeStatus('disconnected');

            const attempt = reconnectAttemptsRef.current + 1;
            reconnectAttemptsRef.current = attempt;
            const delay = Math.min(1000 * 2 ** (attempt - 1), 30000);

            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isMounted) return;
              // On recharge les données pour rattraper ce qu'on a pu manquer,
              // puis on relance la subscription.
              loadMembers();
              setupSubscription();
            }, delay);
          }
        });

      subscriptionRef.current = subscription;
    };

    // Recharger les données quand l'onglet redevient visible (cas typique :
    // l'utilisateur revient sur l'iframe après l'avoir laissée idle longtemps).
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Onglet redevenu visible - rafraîchissement');
        loadMembers();
        // Forcer une reconnexion propre du canal Realtime.
        reconnectAttemptsRef.current = 0;
        setupSubscription();
      }
    };

    const handleOnline = () => {
      console.log('🌐 Connexion réseau rétablie - rafraîchissement');
      loadMembers();
      reconnectAttemptsRef.current = 0;
      setupSubscription();
    };

    loadMembers();
    setupSubscription();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      cleanupSubscription();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
      console.log('🔌 Subscription Supabase fermée');
    };
  }, [loadMembers]);

  return {
    members,
    loading,
    error,
    realtimeStatus,
    loadMembers,
    addMember,
    updateMember,
    deleteMember
  };
};
