# NEWWOR Consulting

Site vitrine et portail client de NEWWOR Consulting, installable comme une PWA (Progressive Web App), optimise pour mobile, avec un vrai backend (authentification + donnees persistantes) via Supabase.

## Contenu
- `index.html` — le site complet (pages publiques, authentification, tableau de bord client)
- `support.js` — runtime necessaire au rendu (framework maison + chargement de React/Babel)
- `assets/` — logo NEWWOR, icones de l'application (`assets/icons/`) et bibliotheques vendorisees (`assets/vendor/`)
- `manifest.json` — metadonnees PWA (nom, icones, couleurs, mode d'affichage)
- `sw.js` — service worker : met en cache la coquille de l'application (HTML/JS/icones/vendor) pour un chargement hors-ligne ; ne met jamais en cache l'authentification ni les donnees dynamiques (Supabase)
- `supabase_schema.sql` — schema de base a executer une seule fois dans le SQL Editor du projet Supabase (tables, securite RLS, trigger de creation de profil)
- `supabase_schema_v2.sql` — a executer une seule fois APRES le script ci-dessus : bucket de stockage prive pour les pieces jointes des tickets, table `milestones` (suivi de projet)
- `supabase_schema_v3.sql` — a executer une seule fois APRES les deux scripts ci-dessus : type de client (`direct` / `service`), table `staff` (equipe NEWWOR) et acces complet de l'equipe a toutes les donnees clients
- `supabase_schema_v4.sql` — a executer une seule fois APRES les trois scripts ci-dessus : expose l'email du client (`clients.email`) pour l'espace equipe (bouton "Envoyer le rapport par email")

## Backend (Supabase)
Le portail client (devis, factures, tickets, authentification) est branche sur un projet
Supabase (Postgres + Auth), configure dans `index.html` juste apres le chargement de
`assets/vendor/supabase.min.js` :
```
window.__sb = window.supabase.createClient("https://<projet>.supabase.co", "<cle anon>");
```
La cle utilisee est la cle publique **anon** : elle est concue pour etre visible cote
navigateur. La securite des donnees ne repose pas sur son secret, mais sur les **policies RLS**
definies dans `supabase_schema.sql` : chaque client authentifie ne peut lire/ecrire que ses
propres devis, factures et tickets (`auth.uid() = client_id`). Ne jamais utiliser la cle
**service_role** du projet dans ce fichier — elle contourne toutes les regles de securite et
doit rester strictement cote serveur.

Mise en route (une seule fois) :
1. Ouvrir le projet Supabase → SQL Editor → coller le contenu de `supabase_schema.sql` → Run.
2. Coller et executer `supabase_schema_v2.sql`, puis `supabase_schema_v3.sql`, puis
   `supabase_schema_v4.sql` (dans cet ordre — les scripts sont rejouables sans erreur si l'un
   d'eux a deja ete execute en partie).
3. Verifier dans Authentication → Providers que "Email" est active (active par defaut).
4. Le site est pret : "Créer un compte" cree un utilisateur Supabase Auth + une ligne
   `clients` automatiquement (trigger `on_auth_user_created`). N'importe quelle adresse email
   (personnelle ou professionnelle) fonctionne pour se connecter — Supabase Auth ne restreint
   aucun domaine ni fournisseur.

Si le projet Supabase exige la confirmation par email (reglage par defaut), un nouveau compte
doit cliquer le lien recu par email avant de pouvoir se connecter — le site l'indique a l'ecran.

## Tickets : categorie, priorite, pieces jointes, satisfaction
- A la creation d'un ticket, le client choisit une categorie (bug / facturation / fonctionnalite /
  autre) et une priorite (basse / normale / haute) — un delai de reponse indicatif s'affiche
  ensuite dans le detail du ticket selon la priorite choisie.
- Recherche et filtre par statut sur la liste des tickets (cote client uniquement, aucune requete
  reseau supplementaire).
- Pieces jointes (5 Mo max) : upload vers le bucket Supabase Storage prive `ticket-attachments`
  (cree par `supabase_schema_v2.sql`), un fichier par message, stocke sous
  `<id utilisateur>/<id ticket>/<horodatage>_<nom fichier>`. Le bucket etant prive, le site
  genere un lien signe temporaire (1h) a chaque affichage plutot que de stocker une URL publique.
- Une fois un ticket resolu ou ferme, le client peut le noter de 1 a 5 (colonne
  `tickets.satisfaction`) ; la zone de reponse disparait alors (ticket clos).
- Changer le statut d'un ticket (ouvert → en cours → en attente client → resolu → ferme) et
  repondre "en tant qu'equipe" se fait desormais directement dans l'espace equipe du site (voir
  section suivante) — il n'est plus necessaire de passer par le Table Editor Supabase.

## Suivi de projet
Onglet "Suivi de projet" dans l'espace client — l'affichage depend du **type du client**
(`clients.client_type`, voir section suivante) :
- **Client direct** : liste complete des jalons du projet (titre, description, statut,
  echeance), avec filtre par statut, comme avant.
- **Client prestataire (`service`)** : vue resumee uniquement — compteurs par statut
  (a faire / en cours / en validation / livre) et prochaine echeance, sans le detail
  (titre/description) de chaque jalon. Pense pour les clients pour lesquels NEWWOR agit comme
  prestataire aupres d'un tiers (ex. fournisseur ayant besoin d'une installation) : ce resume
  est la base d'un futur rapport envoye automatiquement par email (non encore branche — voir
  "Prochaines etapes possibles" ci-dessous).
- Les jalons sont ajoutes, modifies et supprimes par l'equipe NEWWOR via l'espace equipe du
  site (voir section suivante). Statuts possibles : `a_faire`, `en_cours`, `en_validation`,
  `livre`.

## Type de client & espace équipe
- **Type de client** (`clients.client_type`, ajoute par `supabase_schema_v3.sql`) : `direct`
  (par defaut) ou `service` (prestataire — voir ci-dessus). Modifiable uniquement par l'equipe,
  depuis l'espace equipe.
- **Espace équipe** : un utilisateur Supabase Auth ajoute a la table `staff` (Table Editor →
  `staff` → Insert row, avec le meme `id` que son compte Auth — copier l'UUID depuis
  Authentication → Users) voit, apres connexion, un espace different de celui des clients :
  une liste de tous les clients, et pour chaque client selectionne — ses tickets (recherche,
  filtre, changement de statut, reponse en tant qu'equipe avec piece jointe), son suivi de
  projet (ajout/modification/suppression de jalons) et son type de client (direct/prestataire).
  L'acces complet de l'equipe a toutes les donnees clients est defini par les policies RLS
  `staff_full_access_*` de `supabase_schema_v3.sql` (fonction `public.is_staff()`), en plus des
  policies existantes qui limitent chaque client a ses propres donnees — les deux coexistent
  sans se remplacer.
- **Email du client** (`clients.email`, ajoute par `supabase_schema_v4.sql`) : duplique depuis
  `auth.users.email` a l'inscription (n'importe quelle adresse, personnelle ou professionnelle,
  fonctionne — voir "Mise en route" ci-dessus). Visible par l'equipe dans la liste des clients
  et sur la fiche client.
- **Envoi du rapport par email** : bouton "Envoyer le rapport par email" sur la fiche client
  (espace equipe). Declenchement manuel — ouvre le client de messagerie par defaut de la
  personne de l'equipe (lien `mailto:`) avec le destinataire, l'objet et le corps deja remplis :
  le resume par statuts + prochaine echeance pour un client "prestataire" (`service`), la liste
  complete des jalons pour un client "direct". Aucun service tiers requis pour cette premiere
  version. Si le client n'a pas encore d'email enregistre (compte cree avant `supabase_schema_v4.sql`
  et jamais reconnecte depuis), un message l'indique a la place du bouton.
- **Prochaine etape possible** : passer d'un envoi manuel (bouton, ci-dessus) a un envoi
  automatique et recurrent (ex. chaque semaine) sans intervention de l'equipe — necessite de
  choisir/creer un compte aupres d'un service d'envoi d'emails tiers (Resend, SendGrid,
  Postmark...) et une tache planifiee cote serveur (Supabase Edge Function + cron), non encore
  fait.

## Bibliotheques vendorisees (`assets/vendor/`)
Le site utilise React, ReactDOM et Babel Standalone (pour transformer le JSX directement dans le
navigateur). Ces 3 fichiers etaient a l'origine charges depuis `unpkg.com` a chaque demarrage —
ca cassait le site si unpkg etait lent, bloque (reseaux d'entreprise, filtres DNS) ou injoignable,
et empechait tout fonctionnement hors-ligne fiable malgre le service worker.

Ils sont maintenant servis localement depuis `assets/vendor/` :
- `react.production.min.js` (React 18.3.1)
- `react-dom.production.min.js` (ReactDOM 18.3.1)
- `babel.min.js` (@babel/standalone 7.29.0)

Ce sont des copies **strictement identiques** aux versions CDN (hash SHA-384 verifie contre les
`integrity` attendus par `support.js`) — aucun comportement ne change, seule la source du
chargement change. Le redirection se fait via `window.__resources` (defini dans `index.html`
juste avant `<script src="./support.js">`), un mecanisme prevu nativement par le framework pour
ce cas d'usage. Pour mettre a jour ces versions plus tard, regenerer les 3 fichiers et mettre a
jour a la fois `window.__resources` et `sw.js` (`APP_SHELL`).

## Mise en page mobile
Le site n'avait a l'origine aucune regle `@media` : menu lateral et grilles a largeur fixe
debordaient sur petit ecran. Ajouts dans le `<style>` de `index.html` (sous 768px de large) :
- le menu lateral de l'espace client devient une barre horizontale collante en haut ;
- les grilles a 2-3 colonnes (accueil, tableau de bord) s'empilent en 1 colonne ;
- les listes (devis/factures/tickets) s'affichent en cartes empilees (reference + statut,
  objet, montant) plutot qu'en tableau ecrase ou en defilement horizontal ;
- les fenetres modales et la carte de connexion ont une largeur maximale qui s'adapte a l'ecran ;
- un correctif neutralise une regle du framework (`html,body{height:100%}`, injectee par
  `support.js` sur toute page hors editeur) qui empechait completement le defilement des pages
  plus hautes qu'un ecran — voir le commentaire au-dessus de la regle `html, body` dans le
  `<style>` de `index.html` si ce comportement doit un jour etre restaure pour une page precise.

## PWA — installation et compatibilite
- Chrome / Edge (desktop et Android) : invite d'installation automatique.
- Safari iOS : pas d'invite automatique ; un bandeau propose "Partager → Sur l'ecran d'accueil". Le stockage local peut etre vide par iOS apres 7 jours sans ouverture si le site n'a pas ete ajoute a l'ecran d'accueil.
- Firefox : fonctionne comme un site classique si l'installation n'est pas proposee (repli automatique, `display_override`).
- HTTPS obligatoire pour le service worker — deja le cas sur GitHub Pages.
- Apres toute modification de `index.html`, `support.js` ou des assets, incrementer `CACHE_NAME` dans `sw.js` (ex. `newwor-shell-v4`) pour forcer la mise a jour du cache chez les visiteurs.

## Publication (GitHub Pages)
Settings → Pages → Source: `Deploy from a branch` → branche `master`, dossier `/ (root)`.
Le site sera disponible sur `https://newworuser15.github.io/newworco/`.

## Developpement
Aucune dependance, aucun build. Ouvrir `index.html` dans un navigateur
(ou servir le dossier : `python3 -m http.server`).

Pour tester la PWA localement (le service worker ne s'active pas sur `file://`) :
```
python3 -m http.server 8000
```
puis ouvrir `http://localhost:8000` et verifier l'onglet "Application" des DevTools (Manifest, Service Workers) ou lancer l'audit Lighthouse. Pour tester le rendu mobile, ouvrir les DevTools, activer le mode appareil mobile (Ctrl/Cmd+Shift+M) et choisir un gabarit (ex. iPhone).
