import { useState } from 'react';
import './Login.css';

const API_URL = 'http://localhost:3000/api';

/* ---------- Icônes SVG ---------- */

const IconeMail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
);

const IconeCadenas = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

const IconeOeil = ({ barre }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
    {barre && <path d="M4 4l16 16" />}
  </svg>
);

const IconeAlerte = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </svg>
);

const IconeCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/* ---------- Composant Login ---------- */

export default function Login({ onConnexion }) {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);

async function gererConnexion(event) {
    event.preventDefault();

setErreur('');
    setChargement(true);

try {
      const reponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          mot_de_passe: motDePasse,
        }),
      });

let resultat;

try {
        resultat = await reponse.json();
      } catch {
        throw new Error('Le serveur a renvoyé une réponse illisible.');
      }

if (!reponse.ok || !resultat.success) {
        throw new Error(resultat.message || 'Impossible de se connecter.');
      }

if (!resultat.token || !resultat.utilisateur) {
        throw new Error('La réponse du serveur est incomplète.');
      }

onConnexion(resultat);
    } catch (error) {
      setErreur(
        error.message ||
          'Impossible de contacter le serveur. Vérifiez que le backend fonctionne.'
      );
    } finally {
      setChargement(false);
    }
  }

return (
    <div className="login-page">
      <div className="login-blob login-blob--1" aria-hidden="true" />
      <div className="login-blob login-blob--2" aria-hidden="true" />

<main className="login-card">
        {/* Panneau de présentation */}
        <aside className="login-brand">
          <div className="login-brand__top">
            <div className="login-logo">P</div>

<h1 className="login-brand__title">
              Gestion<span>PPN</span>
            </h1>

<p className="login-brand__subtitle">
              Votre espace de gestion de magasin, simple, rapide et sécurisé.
            </p>
          </div>

<ul className="login-brand__features">
            <li>
              <IconeCheck />
              <span>Suivi des stocks en temps réel</span>
            </li>

<li>
              <IconeCheck />
              <span>Gestion des ventes et des clients</span>
            </li>

<li>
              <IconeCheck />
              <span>Rapports et statistiques détaillés</span>
            </li>
          </ul>

<p className="login-brand__footer">
            © {new Date().getFullYear()} GestionPPN
          </p>
        </aside>

{/* Panneau de connexion */}
        <section className="login-form-panel">
          <div className="login-intro">
            <span className="login-badge">Espace sécurisé</span>

<h2>Bienvenue 👋</h2>

<p>
              Connectez-vous pour accéder à votre tableau de bord.
            </p>
          </div>

{erreur && (
            <div
              id="login-error"
              className="login-error"
              role="alert"
              aria-live="polite"
            >
              <IconeAlerte />
              <span>{erreur}</span>
            </div>
          )}

<form onSubmit={gererConnexion}>
            <div className="login-field">
              <label htmlFor="login-email">Adresse e-mail</label>

<div className="login-input">
                <span className="login-input__icon">
                  <IconeMail />
                </span>

<input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  placeholder="admin@gestionppn.local"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={150}
                  required
                  disabled={chargement}
                  aria-invalid={Boolean(erreur)}
                  aria-describedby={erreur ? 'login-error' : undefined}
                />
              </div>
            </div>

<div className="login-field">
              <label htmlFor="login-password">Mot de passe</label>

<div className="login-input">
                <span className="login-input__icon">
                  <IconeCadenas />
                </span>

<input
                  id="login-password"
                  type={afficherMotDePasse ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={motDePasse}
                  onChange={(event) => setMotDePasse(event.target.value)}
                  maxLength={128}
                  required
                  disabled={chargement}
                  aria-invalid={Boolean(erreur)}
                  aria-describedby={erreur ? 'login-error' : undefined}
                />

<button
                  type="button"
                  className="login-input__toggle"
                  onClick={() =>
                    setAfficherMotDePasse((ancien) => !ancien)
                  }
                  aria-label={
                    afficherMotDePasse
                      ? 'Masquer le mot de passe'
                      : 'Afficher le mot de passe'
                  }
                  aria-pressed={afficherMotDePasse}
                  disabled={chargement}
                >
                  <IconeOeil barre={afficherMotDePasse} />
                </button>
              </div>
            </div>

<button
              className="login-submit"
              type="submit"
              disabled={chargement}
            >
              {chargement ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  Connexion en cours…
                </>
              ) : (
                <>
                  <span>Se connecter</span>
                  <span className="login-submit__arrow" aria-hidden="true">
                    →
                  </span>
                </>
              )}
            </button>
          </form>

<p className="login-footer">
            Un problème pour vous connecter ? Contactez votre administrateur.
          </p>
        </section>
      </main>
    </div>
  );
}
