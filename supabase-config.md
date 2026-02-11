# Configuration Supabase

## 1. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte et un nouveau projet
3. Notez l'URL et la clé anonyme

## 2. Créer la table des membres

Exécutez ce SQL dans l'éditeur SQL de Supabase :

```sql
-- Créer la table des membres
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  description TEXT,
  poste TEXT,
  ville TEXT,
  pays TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer un index pour les recherches géographiques
CREATE INDEX idx_members_location ON members USING GIST (point(longitude, latitude));

-- Activer RLS (Row Level Security)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture publique
CREATE POLICY "Allow public read access" ON members
  FOR SELECT USING (true);

-- Politique pour permettre l'insertion publique
CREATE POLICY "Allow public insert" ON members
  FOR INSERT WITH CHECK (true);

-- Politique pour permettre la mise à jour publique
CREATE POLICY "Allow public update" ON members
  FOR UPDATE USING (true);

-- Politique pour permettre la suppression publique
CREATE POLICY "Allow public delete" ON members
  FOR DELETE USING (true);
```

## 3. Variables d'environnement

Créez un fichier `.env.local` avec :

```
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anonyme
```
