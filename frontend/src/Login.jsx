import { useState } from 'react';
import './Login.css';

const API_URL = 'http://localhost:3000/api';

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
        headers: { 'Content-Type': 'application/json' },
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
      <section className="login-card">
        <div className="login-logo">P</div>

        <div className="login-heading">
          <h1>
            Gestion<span>PPN</span>
          </h1>
          <p>Votre espace de gestion de magasin</p>
        </div>

        <div className="login-intro">
          <h2>Bienvenue !</h2>
          <p>Connectez-vous pour accéder à votre espace.</p>
        </div>

        {erreur && (
          <div className="login-error" role="alert">
            {erreur}
          </div>
        )}

        <form onSubmit={gererConnexion}>
          <div className="login-field">
            <label htmlFor="login-email">Adresse e-mail</label>
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
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Mot de passe</label>
            <div className="login-password-wrapper">
              <input
                id="login-password"
                type={afficherMotDePasse ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Saisissez votre mot de passe"
                value={motDePasse}
                onChange={(event) => setMotDePasse(event.target.value)}
                maxLength={128}
                required
                disabled={chargement}
              />
              <button
                type="button"
                className="login-show-password"
                onClick={() => setAfficherMotDePasse((ancien) => !ancien)}
                aria-label={
                  afficherMotDePasse
                    ? 'Masquer le mot de passe'
                    : 'Afficher le mot de passe'
                }
              >
                {afficherMotDePasse ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>

          <button className="login-submit" type="submit" disabled={chargement}>
            {chargement ? 'Connexion en cours…' : 'Se connecter →'}
          </button>
        </form>

        <p className="login-footer">GestionPPN · Espace sécurisé</p>
      </section>
    </div>
  );
}
