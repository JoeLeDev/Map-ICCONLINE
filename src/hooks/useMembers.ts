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

/** Intervalle entre deux synchronisations complètes des membres (hors chargement initial). */
const DATA_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // ~1 h

export const useMembers = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Dernière réussite de chargement des membres (pour limiter les polls HTTP). */
  const lastDataFetchAtRef = useRef(0);

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
  const loadMembers = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const timestamp = Date.now();
      console.log(
        `${silent ? '🔇' : '🔄'} Rechargement des membres (timestamp: ${timestamp})...`
      );

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
      lastDataFetchAtRef.current = Date.now();
      console.log('✅ Membres chargés avec succès');
    } catch (err) {
      console.error('❌ Erreur lors du chargement:', err);
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
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
            reconnectAttemptsRef.current = 0;
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            // Pas de loadMembers ici : évite de faire clignoter la carte et les
            // requêtes en boucle. Les données sont resynchronisées toutes les ~1 h
            // (timer + retour onglet si la dernière sync date de plus d'1 h).
            console.warn(
              `⚠️ Canal Realtime perdu (${status}). Reconnexion WebSocket seule...`
            );

            const attempt = reconnectAttemptsRef.current + 1;
            reconnectAttemptsRef.current = attempt;
            // Délais espacés (1 min → 15 min max) pour ne pas marteler Supabase.
            const delay = Math.min(60_000 * attempt, 15 * 60_000);

            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isMounted) return;
              setupSubscription();
            }, delay);
          }
        });

      subscriptionRef.current = subscription;
    };

    // Rafraîchir les données depuis l'API seulement si la dernière sync date de
    // plus d'une heure (évite le « refresh en boucle » à chaque focus d'onglet).
    const refreshDataIfStale = () => {
      const last = lastDataFetchAtRef.current;
      if (last === 0) return;
      if (Date.now() - last < DATA_REFRESH_INTERVAL_MS) return;
      console.log('⏰ Dernière sync > 1 h — rechargement silencieux des membres');
      void loadMembers({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshDataIfStale();
      }
    };

    const handleOnline = () => {
      refreshDataIfStale();
    };

    loadMembers();
    setupSubscription();

    const hourlyRefresh = setInterval(() => {
      void loadMembers({ silent: true });
    }, DATA_REFRESH_INTERVAL_MS);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      isMounted = false;
      clearInterval(hourlyRefresh);
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
    loadMembers,
    addMember,
    updateMember,
    deleteMember
  };
};
