import { useEffect, useMemo, useState } from 'react';
import './App.css';
import Login from './Login.jsx';

const API_URL = 'http://localhost:3000/api';

const formulaireProduitInitial = {
  categorie_id: '',
  nom: '',
  description: '',
  reference: '',
  code_barres: '',
  image: '',
  prix_achat: '0',
  prix_vente: '',
  stock_physique: '0',
  seuil_alerte: '5',
  unite: 'pièce',
};

const formulaireCategorieInitial = {
  nom: '',
  description: '',
  image: '',
};

const navigation = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '▦' },
  { id: 'produits', label: 'Produits', icon: '▣' },
  { id: 'categories', label: 'Catégories', icon: '▤' },
  { id: 'stock', label: 'Stock', icon: '▥' },
];

function App() {
  // Session d'authentification
  const [token, setToken] = useState(() => sessionStorage.getItem('gestionppn_token') || '');
  const [utilisateur, setUtilisateur] = useState(null);
  const [sessionVerifiee, setSessionVerifiee] = useState(false);

  const [pageActive, setPageActive] = useState('dashboard');
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false);

  const [produits, setProduits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  const [rechercheProduit, setRechercheProduit] = useState('');
  const [rechercheCategorie, setRechercheCategorie] = useState('');
  const [formulaireProduit, setFormulaireProduit] = useState(formulaireProduitInitial);
  const [formulaireCategorie, setFormulaireCategorie] = useState(formulaireCategorieInitial);
  const [produitEnEdition, setProduitEnEdition] = useState(null);
  const [categorieEnEdition, setCategorieEnEdition] = useState(null);
  const [formulaireProduitVisible, setFormulaireProduitVisible] = useState(false);
  const [formulaireCategorieVisible, setFormulaireCategorieVisible] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [suppressionProduitId, setSuppressionProduitId] = useState(null);
  const [suppressionCategorieId, setSuppressionCategorieId] = useState(null);

  // Gestion des mouvements de stock
  const [mouvements, setMouvements] = useState([]);
  const [typeMouvement, setTypeMouvement] = useState('ENTREE');
  const [formulaireStock, setFormulaireStock] = useState({
    produit_id: '',
    quantite: '1',
    motif: '',
  });
  const [chargementStock, setChargementStock] = useState(false);
  const [enregistrementStock, setEnregistrementStock] = useState(false);

  async function requeteApi(url, options = {}) {
    const jeton = sessionStorage.getItem('gestionppn_token') || token;
    const reponse = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
        ...(options.headers || {}),
      },
    });

    let resultat;
    try {
      resultat = await reponse.json();
    } catch {
      throw new Error('Le serveur a renvoyé une réponse illisible.');
    }

    if (reponse.status === 401) {
      sessionStorage.removeItem('gestionppn_token');
      setToken('');
      setUtilisateur(null);
      setSessionVerifiee(true);
      throw new Error('Votre session a expiré. Veuillez vous reconnecter.');
    }

    if (!reponse.ok || resultat.success === false) {
      throw new Error(resultat.message || 'Une erreur est survenue.');
    }

    return resultat;
  }

  async function chargerProduits() {
    const resultat = await requeteApi(`${API_URL}/produits`);
    setProduits(resultat.produits || []);
  }

  async function chargerCategories() {
    const resultat = await requeteApi(`${API_URL}/categories`);
    setCategories(resultat.categories || []);
  }

  async function chargerMouvements() {
    const resultat = await requeteApi(`${API_URL}/mouvements-stock`);
    setMouvements(resultat.mouvements || []);
  }

  async function actualiserDonneesStock() {
    setChargementStock(true);
    try {
      await Promise.all([chargerProduits(), chargerMouvements()]);
    } catch (error) {
      console.error('Erreur chargement stock :', error);
      setMessage(error.message || 'Impossible de charger les mouvements de stock.');
    } finally {
      setChargementStock(false);
    }
  }

  async function enregistrerMouvementStock(event) {
    event.preventDefault();
    setMessage('');

    const produitId = Number(formulaireStock.produit_id);
    const quantite = Number(formulaireStock.quantite);

    if (!Number.isInteger(produitId) || produitId <= 0) {
      setMessage('Choisissez un produit.');
      return;
    }
    if (!Number.isInteger(quantite) || quantite <= 0) {
      setMessage('La quantité doit être un entier supérieur à zéro.');
      return;
    }

    setEnregistrementStock(true);
    try {
      const resultat = await requeteApi(`${API_URL}/mouvements-stock`, {
        method: 'POST',
        body: JSON.stringify({
          produit_id: produitId,
          type: typeMouvement,
          quantite,
          motif: formulaireStock.motif,
        }),
      });

      setMessage(resultat.message || 'Mouvement de stock enregistré.');
      setFormulaireStock({ produit_id: '', quantite: '1', motif: '' });
      await Promise.all([chargerProduits(), chargerMouvements()]);
    } catch (error) {
      console.error('Erreur enregistrement stock :', error);
      setMessage(error.message || 'Impossible d’enregistrer le mouvement de stock.');
    } finally {
      setEnregistrementStock(false);
    }
  }

  async function chargerDonnees() {
    setChargement(true);
    setErreur('');

    try {
      await Promise.all([chargerProduits(), chargerCategories()]);
    } catch (error) {
      console.error(error);
      setErreur('Impossible de charger les données. Vérifiez que le backend et MariaDB fonctionnent.');
    } finally {
      setChargement(false);
    }
  }

  // Vérifier le jeton sauvegardé avant d'afficher le tableau de bord.
  useEffect(() => {
    let annule = false;

    async function verifierSession() {
      const jeton = sessionStorage.getItem('gestionppn_token');

      if (!jeton) {
        if (!annule) {
          setToken('');
          setUtilisateur(null);
          setChargement(false);
          setSessionVerifiee(true);
        }
        return;
      }

      try {
        const reponse = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${jeton}` },
        });
        const resultat = await reponse.json();

        if (!reponse.ok || !resultat.success || !resultat.utilisateur) {
          throw new Error('Session invalide.');
        }

        if (!annule) {
          setToken(jeton);
          setUtilisateur(resultat.utilisateur);
        }
      } catch {
        sessionStorage.removeItem('gestionppn_token');
        if (!annule) {
          setToken('');
          setUtilisateur(null);
        }
      } finally {
        if (!annule) setSessionVerifiee(true);
      }
    }

    verifierSession();
    return () => { annule = true; };
  }, []);

  // Les données ne sont chargées qu'après la validation de la session.
  useEffect(() => {
    if (!sessionVerifiee) return;
    if (token && utilisateur) {
      chargerDonnees();
    } else {
      setChargement(false);
    }
  }, [sessionVerifiee, token, utilisateur]);

  useEffect(() => {
    if (sessionVerifiee && token && utilisateur && pageActive === 'stock') {
      actualiserDonneesStock();
    }
  }, [sessionVerifiee, token, utilisateur, pageActive]);

  function gererConnexion(resultat) {
    sessionStorage.setItem('gestionppn_token', resultat.token);
    setToken(resultat.token);
    setUtilisateur(resultat.utilisateur);
    setSessionVerifiee(true);
    setPageActive('dashboard');
    setErreur('');
    setMessage('Connexion réussie. Bienvenue dans GestionPPN !');
    setChargement(true);
  }

  function deconnecter() {
    sessionStorage.removeItem('gestionppn_token');
    setToken('');
    setUtilisateur(null);
    setPageActive('dashboard');
    setProduits([]);
    setCategories([]);
    setMouvements([]);
    setErreur('');
    setMessage('');
    setMenuMobileOuvert(false);
    setChargement(false);
  }

  function afficherPage(page) {
    setPageActive(page);
    setMenuMobileOuvert(false);
    setMessage('');
    setFormulaireProduitVisible(false);
    setFormulaireCategorieVisible(false);
    setProduitEnEdition(null);
    setCategorieEnEdition(null);
  }

  function formaterPrix(prix) {
    const montant = Number(prix);
    if (!Number.isFinite(montant)) return 'Prix indisponible';
    return `${montant.toLocaleString('fr-FR')} Ar`;
  }

  function stockDisponible(produit) {
    return Math.max(
      0,
      Number(produit.stock_physique || 0) - Number(produit.stock_reserve || 0)
    );
  }

  const produitsFiltres = useMemo(() => {
    const terme = rechercheProduit.toLowerCase().trim();
    return produits.filter((produit) =>
      [produit.nom, produit.reference, produit.categorie]
        .some((valeur) => String(valeur || '').toLowerCase().includes(terme))
    );
  }, [produits, rechercheProduit]);

  const categoriesFiltrees = useMemo(() => {
    const terme = rechercheCategorie.toLowerCase().trim();
    return categories.filter((categorie) =>
      [categorie.nom, categorie.description]
        .some((valeur) => String(valeur || '').toLowerCase().includes(terme))
    );
  }, [categories, rechercheCategorie]);

  const produitsEnAlerte = produits.filter(
    (produit) => stockDisponible(produit) <= Number(produit.seuil_alerte ?? 5)
  );

  function ouvrirAjoutProduit() {
    setProduitEnEdition(null);
    setFormulaireProduit({
      ...formulaireProduitInitial,
      categorie_id: categories.length ? String(categories[0].id) : '',
    });
    setMessage('');
    setFormulaireProduitVisible(true);
  }

  function ouvrirModificationProduit(produit) {
    setProduitEnEdition(produit.id);
    setFormulaireProduit({
      categorie_id: String(
        produit.categorie_id ?? categories.find((cat) => cat.nom === produit.categorie)?.id ?? ''
      ),
      nom: produit.nom || '',
      description: produit.description || '',
      reference: produit.reference || '',
      code_barres: produit.code_barres || '',
      image: produit.image || '',
      prix_achat: String(produit.prix_achat ?? 0),
      prix_vente: String(produit.prix_vente ?? ''),
      stock_physique: String(produit.stock_physique ?? 0),
      seuil_alerte: String(produit.seuil_alerte ?? 5),
      unite: produit.unite || 'pièce',
    });
    setMessage('');
    setFormulaireProduitVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function gererChangementProduit(event) {
    const { name, value } = event.target;
    setFormulaireProduit((ancien) => ({ ...ancien, [name]: value }));
  }

  async function enregistrerProduit(event) {
    event.preventDefault();
    setMessage('');
    setEnregistrement(true);

    try {
      const donnees = {
        ...formulaireProduit,
        categorie_id: Number(formulaireProduit.categorie_id),
        prix_achat: Number(formulaireProduit.prix_achat),
        prix_vente: Number(formulaireProduit.prix_vente),
        stock_physique: Number(formulaireProduit.stock_physique),
        seuil_alerte: Number(formulaireProduit.seuil_alerte),
      };
      const modification = produitEnEdition !== null;

      const resultat = await requeteApi(
        modification ? `${API_URL}/produits/${produitEnEdition}` : `${API_URL}/produits`,
        {
          method: modification ? 'PUT' : 'POST',
          body: JSON.stringify(donnees),
        }
      );

      setMessage(resultat.message || (modification ? 'Produit modifié avec succès.' : 'Produit ajouté avec succès.'));
      setFormulaireProduitVisible(false);
      setProduitEnEdition(null);
      setFormulaireProduit(formulaireProduitInitial);
      await chargerProduits();
    } catch (error) {
      console.error(error);
      setMessage(error.message || 'Impossible d’enregistrer le produit.');
    } finally {
      setEnregistrement(false);
    }
  }

  async function supprimerProduit(produit) {
    if (!window.confirm(`Voulez-vous vraiment désactiver le produit « ${produit.nom} » ?`)) return;

    setSuppressionProduitId(produit.id);
    setMessage('');
    try {
      const resultat = await requeteApi(`${API_URL}/produits/${produit.id}`, { method: 'DELETE' });
      setProduits((anciens) => anciens.filter((item) => item.id !== produit.id));
      setMessage(resultat.message || 'Produit désactivé avec succès.');
    } catch (error) {
      setMessage(error.message || 'Erreur lors de la désactivation du produit.');
    } finally {
      setSuppressionProduitId(null);
    }
  }

  function ouvrirAjoutCategorie() {
    setCategorieEnEdition(null);
    setFormulaireCategorie(formulaireCategorieInitial);
    setMessage('');
    setFormulaireCategorieVisible(true);
  }

  function ouvrirModificationCategorie(categorie) {
    setCategorieEnEdition(categorie.id);
    setFormulaireCategorie({
      nom: categorie.nom || '',
      description: categorie.description || '',
      image: categorie.image || '',
    });
    setMessage('');
    setFormulaireCategorieVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function gererChangementCategorie(event) {
    const { name, value } = event.target;
    setFormulaireCategorie((ancien) => ({ ...ancien, [name]: value }));
  }

  async function enregistrerCategorie(event) {
    event.preventDefault();
    setMessage('');
    setEnregistrement(true);

    try {
      const modification = categorieEnEdition !== null;
      const resultat = await requeteApi(
        modification ? `${API_URL}/categories/${categorieEnEdition}` : `${API_URL}/categories`,
        {
          method: modification ? 'PUT' : 'POST',
          body: JSON.stringify(formulaireCategorie),
        }
      );

      setMessage(resultat.message || (modification ? 'Catégorie modifiée avec succès.' : 'Catégorie ajoutée avec succès.'));
      setFormulaireCategorieVisible(false);
      setCategorieEnEdition(null);
      setFormulaireCategorie(formulaireCategorieInitial);
      await chargerCategories();
      await chargerProduits();
    } catch (error) {
      console.error(error);
      setMessage(error.message || 'Impossible d’enregistrer la catégorie.');
    } finally {
      setEnregistrement(false);
    }
  }

  async function supprimerCategorie(categorie) {
    const confirmation = window.confirm(
      `Voulez-vous vraiment désactiver la catégorie « ${categorie.nom} » ?`
    );
    if (!confirmation) return;

    setSuppressionCategorieId(categorie.id);
    setMessage('');

    try {
      const resultat = await requeteApi(
        `${API_URL}/categories/${categorie.id}`,
        { method: 'DELETE' }
      );

      // Recharger les catégories actives depuis le backend.
      await chargerCategories();
      setMessage(resultat.message || 'Catégorie désactivée avec succès.');
    } catch (error) {
      console.error('Erreur désactivation catégorie :', error);
      const messageErreur = error.message || 'Erreur lors de la désactivation de la catégorie.';
      setMessage(messageErreur);
      window.alert(messageErreur);
    } finally {
      setSuppressionCategorieId(null);
    }
  }

  function fermerFormulaires() {
    setFormulaireProduitVisible(false);
    setFormulaireCategorieVisible(false);
    setProduitEnEdition(null);
    setCategorieEnEdition(null);
  }

  function MessageEtat() {
    if (chargement) {
      return <div className="state-panel"><span className="state-icon">⏳</span><h3>Chargement des données…</h3><p>Connexion au catalogue GestionPPN.</p></div>;
    }
    if (erreur) {
      return <div className="state-panel state-error"><span className="state-icon">⚠</span><h3>Chargement impossible</h3><p>{erreur}</p><button className="button button-primary" onClick={chargerDonnees}>Réessayer</button></div>;
    }
    return null;
  }

  if (!sessionVerifiee) {
    return (
      <div className="login-page">
        <div className="login-card" role="status">Vérification de votre session…</div>
      </div>
    );
  }

  if (!token || !utilisateur) {
    return <Login onConnexion={gererConnexion} />;
  }

  return (
    <div className="admin-app">
      <button
        type="button"
        className={`sidebar-overlay ${menuMobileOuvert ? 'visible' : ''}`}
        aria-label="Fermer le menu"
        onClick={() => setMenuMobileOuvert(false)}
      />

      <aside className={`sidebar ${menuMobileOuvert ? 'sidebar-open' : ''}`}>
        <button type="button" className="brand" onClick={() => afficherPage('dashboard')}>
          <span className="brand-mark">P</span>
          <span className="brand-name">Gestion<span>PPN</span><small>GESTION DE MAGASIN</small></span>
        </button>

        <div className="sidebar-label">MENU PRINCIPAL</div>
        <nav className="sidebar-nav" aria-label="Navigation principale">
          {navigation.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`nav-item ${pageActive === item.id ? 'active' : ''}`}
              onClick={() => afficherPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'stock' && produitsEnAlerte.length > 0 && (
                <span className="nav-badge">{produitsEnAlerte.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-dot" /> Catalogue connecté</div>
          <div className="sidebar-version">GestionPPN · Version locale</div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="mobile-menu-button" onClick={() => setMenuMobileOuvert(true)} aria-label="Ouvrir le menu">☰</button>
            <div>
              <div className="breadcrumb">GestionPPN <span>/</span> {navigation.find((item) => item.id === pageActive)?.label || 'Tableau de bord'}</div>
              <h1>{navigation.find((item) => item.id === pageActive)?.label || 'Tableau de bord'}</h1>
            </div>
          </div>
          <div className="topbar-right">
            <span className="today-label">{utilisateur.role ? utilisateur.role.replace(/_/g, ' ').toUpperCase() : 'ESPACE UTILISATEUR'}</span>
            <span className="topbar-user-name">{[utilisateur.prenom, utilisateur.nom].filter(Boolean).join(' ') || utilisateur.email}</span>
            <span className="user-avatar">{(utilisateur.prenom?.[0] || utilisateur.nom?.[0] || utilisateur.email?.[0] || 'U').toUpperCase()}</span>
            <button type="button" className="button button-light" onClick={deconnecter}>Déconnexion</button>
          </div>
        </header>

        <main className="page-content">
          {message && (
            <div className="alert-message" role="status">
              <span>{message}</span>
              <button type="button" onClick={() => setMessage('')} aria-label="Fermer le message">×</button>
            </div>
          )}

          {pageActive === 'dashboard' && (
            <section>
              <div className="welcome-panel">
                <div>
                  <span className="eyebrow">VUE D'ENSEMBLE</span>
                  <h2>Bonjour et bienvenue 👋</h2>
                  <p>Voici un aperçu de votre magasin et de votre catalogue de produits.</p>
                </div>
                <div className="welcome-art" aria-hidden="true">▥</div>
              </div>

              <MessageEtat />

              {!chargement && !erreur && (
                <>
                  <div className="stats-grid">
                    <article className="stat-card"><span className="stat-icon green">▣</span><span className="stat-label">Produits actifs</span><strong>{produits.length}</strong><small>Produits dans le catalogue</small></article>
                    <article className="stat-card"><span className="stat-icon blue">▤</span><span className="stat-label">Catégories actives</span><strong>{categories.length}</strong><small>Familles de produits</small></article>
                    <article className="stat-card"><span className="stat-icon orange">⚠</span><span className="stat-label">Stocks à surveiller</span><strong>{produitsEnAlerte.length}</strong><small>Au seuil d'alerte ou en dessous</small></article>
                    <article className="stat-card"><span className="stat-icon violet">▥</span><span className="stat-label">Unités disponibles</span><strong>{produits.reduce((total, produit) => total + stockDisponible(produit), 0).toLocaleString('fr-FR')}</strong><small>Stock disponible cumulé</small></article>
                  </div>

                  <div className="content-card">
                    <div className="card-heading"><div><span className="eyebrow">ACCÈS RAPIDE</span><h2>Gérer votre magasin</h2></div></div>
                    <div className="quick-actions">
                      <button type="button" className="quick-action" onClick={() => { afficherPage('produits'); ouvrirAjoutProduit(); }}><span>＋</span><strong>Ajouter un produit</strong><small>Enrichir votre catalogue</small></button>
                      <button type="button" className="quick-action" onClick={() => { afficherPage('categories'); ouvrirAjoutCategorie(); }}><span>▤</span><strong>Ajouter une catégorie</strong><small>Organiser les produits</small></button>
                      <button type="button" className="quick-action" onClick={() => afficherPage('stock')}><span>▥</span><strong>Consulter le stock</strong><small>Voir les alertes de stock</small></button>
                    </div>
                  </div>

                  <div className="content-card">
                    <div className="card-heading"><div><span className="eyebrow">CATALOGUE</span><h2>Produits récemment listés</h2></div><button type="button" className="button button-light" onClick={() => afficherPage('produits')}>Voir les produits →</button></div>
                    {produits.length === 0 ? <p className="muted-text">Aucun produit n'est encore enregistré.</p> : (
                      <div className="table-wrap"><table><thead><tr><th>Produit</th><th>Catégorie</th><th>Prix de vente</th><th>Stock disponible</th></tr></thead><tbody>
                        {produits.slice(0, 5).map((produit) => <tr key={produit.id}><td className="table-product">{produit.nom}</td><td>{produit.categorie || '—'}</td><td>{formaterPrix(produit.prix_vente)}</td><td><span className={stockDisponible(produit) <= Number(produit.seuil_alerte ?? 5) ? 'stock-pill low' : 'stock-pill'}>{stockDisponible(produit)} {produit.unite || 'pièce'}</span></td></tr>)}
                      </tbody></table></div>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {pageActive === 'produits' && (
            <section>
              <div className="page-intro"><div><span className="eyebrow">CATALOGUE DU MAGASIN</span><h2>Tous les produits</h2><p>Ajoutez, recherchez et mettez à jour les produits de votre magasin.</p></div><button type="button" className="button button-primary" onClick={ouvrirAjoutProduit}>＋ Ajouter un produit</button></div>
              <MessageEtat />

              {!chargement && !erreur && formulaireProduitVisible && (
                <div className="content-card form-card">
                  <div className="card-heading"><div><span className="eyebrow">{produitEnEdition !== null ? 'MODIFICATION' : 'NOUVEAU PRODUIT'}</span><h2>{produitEnEdition !== null ? 'Modifier le produit' : 'Ajouter un produit'}</h2></div><button type="button" className="icon-button" onClick={fermerFormulaires} aria-label="Fermer le formulaire">×</button></div>
                  {categories.length === 0 ? <p className="form-error">Aucune catégorie disponible. Créez d'abord une catégorie dans la rubrique Catégories.</p> : (
                    <form onSubmit={enregistrerProduit}>
                      <div className="form-grid">
                        <div className="form-group"><label htmlFor="p-nom">Nom du produit *</label><input id="p-nom" name="nom" value={formulaireProduit.nom} onChange={gererChangementProduit} maxLength={150} required /></div>
                        <div className="form-group"><label htmlFor="p-categorie">Catégorie *</label><select id="p-categorie" name="categorie_id" value={formulaireProduit.categorie_id} onChange={gererChangementProduit} required><option value="">Choisir une catégorie</option>{categories.map((categorie) => <option key={categorie.id} value={categorie.id}>{categorie.nom}</option>)}</select></div>
                        <div className="form-group"><label htmlFor="p-reference">Référence</label><input id="p-reference" name="reference" value={formulaireProduit.reference} onChange={gererChangementProduit} maxLength={100} /></div>
                        <div className="form-group"><label htmlFor="p-code-barres">Code-barres</label><input id="p-code-barres" name="code_barres" value={formulaireProduit.code_barres} onChange={gererChangementProduit} maxLength={100} /></div>
                        <div className="form-group"><label htmlFor="p-prix-achat">Prix d'achat (Ar)</label><input id="p-prix-achat" name="prix_achat" type="number" min="0" step="0.01" value={formulaireProduit.prix_achat} onChange={gererChangementProduit} required /></div>
                        <div className="form-group"><label htmlFor="p-prix-vente">Prix de vente (Ar) *</label><input id="p-prix-vente" name="prix_vente" type="number" min="0" step="0.01" value={formulaireProduit.prix_vente} onChange={gererChangementProduit} required /></div>
                        <div className="form-group"><label htmlFor="p-stock">Stock physique</label><input id="p-stock" name="stock_physique" type="number" min="0" step="1" value={formulaireProduit.stock_physique} onChange={gererChangementProduit} required /></div>
                        <div className="form-group"><label htmlFor="p-seuil">Seuil d'alerte</label><input id="p-seuil" name="seuil_alerte" type="number" min="0" step="1" value={formulaireProduit.seuil_alerte} onChange={gererChangementProduit} required /></div>
                        <div className="form-group"><label htmlFor="p-unite">Unité</label><select id="p-unite" name="unite" value={formulaireProduit.unite} onChange={gererChangementProduit}><option value="pièce">Pièce</option><option value="kg">Kilogramme (kg)</option><option value="g">Gramme (g)</option><option value="litre">Litre</option><option value="sac">Sac</option><option value="carton">Carton</option><option value="paquet">Paquet</option></select></div>
                        <div className="form-group"><label htmlFor="p-image">URL de l'image</label><input id="p-image" name="image" type="url" value={formulaireProduit.image} onChange={gererChangementProduit} placeholder="https://exemple.com/image.jpg" /></div>
                        <div className="form-group form-group-full"><label htmlFor="p-description">Description</label><textarea id="p-description" name="description" rows="3" value={formulaireProduit.description} onChange={gererChangementProduit} /></div>
                      </div>
                      <div className="form-actions"><button type="button" className="button button-light" onClick={fermerFormulaires} disabled={enregistrement}>Annuler</button><button type="submit" className="button button-primary" disabled={enregistrement}>{enregistrement ? 'Enregistrement…' : produitEnEdition !== null ? 'Enregistrer les modifications' : 'Ajouter le produit'}</button></div>
                    </form>
                  )}
                </div>
              )}

              {!chargement && !erreur && (
                <div className="content-card">
                  <div className="toolbar"><div className="search-field"><span>⌕</span><input type="search" value={rechercheProduit} onChange={(event) => setRechercheProduit(event.target.value)} placeholder="Rechercher par nom, référence ou catégorie…" aria-label="Rechercher un produit" /></div><span className="result-count">{produitsFiltres.length} produit(s)</span></div>
                  {produitsFiltres.length === 0 ? <div className="empty-state"><span>▣</span><h3>{rechercheProduit ? 'Aucun résultat' : 'Aucun produit'}</h3><p>{rechercheProduit ? 'Essayez un autre terme de recherche.' : 'Ajoutez votre premier produit au catalogue.'}</p></div> : (
                    <div className="table-wrap"><table><thead><tr><th>Produit</th><th>Catégorie</th><th>Référence</th><th>Prix de vente</th><th>Stock</th><th>Actions</th></tr></thead><tbody>
                      {produitsFiltres.map((produit) => <tr key={produit.id}><td><div className="table-product-cell">{produit.image ? <img src={produit.image} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <span className="mini-product-icon">▣</span>}<div><strong>{produit.nom}</strong>{produit.description && <small>{produit.description}</small>}</div></div></td><td>{produit.categorie || '—'}</td><td>{produit.reference || '—'}</td><td className="price-cell">{formaterPrix(produit.prix_vente)}</td><td><span className={stockDisponible(produit) <= Number(produit.seuil_alerte ?? 5) ? 'stock-pill low' : 'stock-pill'}>{stockDisponible(produit)} {produit.unite || 'pièce'}</span></td><td><div className="table-actions"><button type="button" className="text-action" onClick={() => ouvrirModificationProduit(produit)}>Modifier</button><button type="button" className="text-action danger" onClick={() => supprimerProduit(produit)} disabled={suppressionProduitId === produit.id}>{suppressionProduitId === produit.id ? 'Désactivation…' : 'Désactiver'}</button></div></td></tr>)}
                    </tbody></table></div>
                  )}
                </div>
              )}
            </section>
          )}

          {pageActive === 'categories' && (
            <section>
              <div className="page-intro"><div><span className="eyebrow">ORGANISATION DU CATALOGUE</span><h2>Gestion des catégories</h2><p>Organisez les produits en familles faciles à retrouver.</p></div><button type="button" className="button button-primary" onClick={ouvrirAjoutCategorie}>＋ Ajouter une catégorie</button></div>
              <MessageEtat />

              {!chargement && !erreur && formulaireCategorieVisible && (
                <div className="content-card form-card">
                  <div className="card-heading"><div><span className="eyebrow">{categorieEnEdition !== null ? 'MODIFICATION' : 'NOUVELLE CATÉGORIE'}</span><h2>{categorieEnEdition !== null ? 'Modifier la catégorie' : 'Ajouter une catégorie'}</h2></div><button type="button" className="icon-button" onClick={fermerFormulaires} aria-label="Fermer le formulaire">×</button></div>
                  <form onSubmit={enregistrerCategorie}>
                    <div className="form-grid">
                      <div className="form-group"><label htmlFor="c-nom">Nom de la catégorie *</label><input id="c-nom" name="nom" value={formulaireCategorie.nom} onChange={gererChangementCategorie} maxLength={100} placeholder="Ex. Boissons" required /></div>
                      <div className="form-group"><label htmlFor="c-image">URL de l'image</label><input id="c-image" name="image" type="url" value={formulaireCategorie.image} onChange={gererChangementCategorie} placeholder="https://exemple.com/image.jpg" /></div>
                      <div className="form-group form-group-full"><label htmlFor="c-description">Description</label><textarea id="c-description" name="description" value={formulaireCategorie.description} onChange={gererChangementCategorie} rows="3" placeholder="Décrivez cette catégorie…" /></div>
                    </div>
                    <div className="form-actions"><button type="button" className="button button-light" onClick={fermerFormulaires} disabled={enregistrement}>Annuler</button><button type="submit" className="button button-primary" disabled={enregistrement}>{enregistrement ? 'Enregistrement…' : categorieEnEdition !== null ? 'Enregistrer les modifications' : 'Ajouter la catégorie'}</button></div>
                  </form>
                </div>
              )}

              {!chargement && !erreur && (
                <div className="content-card">
                  <div className="toolbar"><div className="search-field"><span>⌕</span><input type="search" value={rechercheCategorie} onChange={(event) => setRechercheCategorie(event.target.value)} placeholder="Rechercher une catégorie…" aria-label="Rechercher une catégorie" /></div><span className="result-count">{categoriesFiltrees.length} catégorie(s)</span></div>
                  {categoriesFiltrees.length === 0 ? <div className="empty-state"><span>▤</span><h3>{rechercheCategorie ? 'Aucun résultat' : 'Aucune catégorie'}</h3><p>{rechercheCategorie ? 'Essayez un autre terme.' : 'Créez une catégorie pour organiser vos produits.'}</p><button type="button" className="button button-primary" onClick={ouvrirAjoutCategorie}>＋ Ajouter une catégorie</button></div> : (
                    <div className="category-admin-grid">
                      {categoriesFiltrees.map((categorie, index) => {
                        const totalProduits = produits.filter((produit) => Number(produit.categorie_id) === Number(categorie.id) || produit.categorie === categorie.nom).length;
                        return <article className="category-admin-card" key={categorie.id}>
                          <div className="category-admin-top"><span className={`category-symbol symbol-${index % 4}`}>{categorie.image ? <img src={categorie.image} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : ['▤', '◈', '▣', '◇'][index % 4]}</span><span className="active-tag"><span /> Active</span></div>
                          <h3>{categorie.nom}</h3><p>{categorie.description || 'Aucune description renseignée.'}</p>
                          <div className="category-admin-meta"><span>{totalProduits} produit(s)</span><span>ID #{categorie.id}</span></div>
                          <div className="category-card-actions"><button type="button" className="button button-light" onClick={() => ouvrirModificationCategorie(categorie)}>Modifier</button><button type="button" className="button button-danger-light" onClick={() => supprimerCategorie(categorie)} disabled={suppressionCategorieId === categorie.id}>{suppressionCategorieId === categorie.id ? 'Désactivation…' : 'Désactiver'}</button></div>
                        </article>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {pageActive === 'stock' && (
            <section>
              <div className="page-intro">
                <div>
                  <span className="eyebrow">SUIVI DES QUANTITÉS</span>
                  <h2>Gestion du stock</h2>
                  <p>Enregistrez les entrées et sorties et consultez l'historique de chaque mouvement.</p>
                </div>
                <button type="button" className="button button-light" onClick={actualiserDonneesStock} disabled={chargementStock}>
                  {chargementStock ? 'Actualisation…' : '↻ Actualiser'}
                </button>
              </div>

              <MessageEtat />

              {!chargement && !erreur && (
                <>
                  <div className="stats-grid stock-stats">
                    <article className="stat-card"><span className="stat-icon green">▥</span><span className="stat-label">Produits suivis</span><strong>{produits.length}</strong><small>Produits actifs</small></article>
                    <article className="stat-card"><span className="stat-icon orange">⚠</span><span className="stat-label">Stock faible</span><strong>{produitsEnAlerte.length}</strong><small>Au seuil ou en dessous</small></article>
                    <article className="stat-card"><span className="stat-icon blue">↕</span><span className="stat-label">Mouvements enregistrés</span><strong>{mouvements.length}</strong><small>Entrées et sorties</small></article>
                  </div>

                  <div className="content-card form-card">
                    <div className="card-heading">
                      <div><span className="eyebrow">NOUVEAU MOUVEMENT</span><h2>Enregistrer une entrée ou une sortie</h2></div>
                    </div>
                    <form onSubmit={enregistrerMouvementStock}>
                      <div className="form-grid">
                        <div className="form-group">
                          <label htmlFor="stock-type">Type de mouvement *</label>
                          <select id="stock-type" value={typeMouvement} onChange={(event) => setTypeMouvement(event.target.value)}>
                            <option value="ENTREE">Entrée de stock (+)</option>
                            <option value="SORTIE">Sortie de stock (−)</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label htmlFor="stock-produit">Produit *</label>
                          <select id="stock-produit" value={formulaireStock.produit_id} onChange={(event) => setFormulaireStock((ancien) => ({ ...ancien, produit_id: event.target.value }))} required>
                            <option value="">Choisir un produit</option>
                            {produits.map((produit) => (
                              <option key={produit.id} value={produit.id}>
                                {produit.nom} — stock disponible : {stockDisponible(produit)} {produit.unite || 'pièce'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label htmlFor="stock-quantite">Quantité *</label>
                          <input id="stock-quantite" type="number" min="1" step="1" inputMode="numeric" value={formulaireStock.quantite} onChange={(event) => setFormulaireStock((ancien) => ({ ...ancien, quantite: event.target.value }))} required />
                        </div>
                        <div className="form-group">
                          <label htmlFor="stock-motif">Motif</label>
                          <input id="stock-motif" type="text" maxLength="255" value={formulaireStock.motif} onChange={(event) => setFormulaireStock((ancien) => ({ ...ancien, motif: event.target.value }))} placeholder={typeMouvement === 'ENTREE' ? 'Ex. Réapprovisionnement' : 'Ex. Vente, produit abîmé…'} />
                        </div>
                      </div>
                      {produits.length === 0 && <p className="form-error">Aucun produit actif. Ajoutez d'abord un produit dans la rubrique Produits.</p>}
                      <div className="form-actions">
                        <button type="button" className="button button-light" onClick={() => setFormulaireStock({ produit_id: '', quantite: '1', motif: '' })} disabled={enregistrementStock}>Réinitialiser</button>
                        <button type="submit" className="button button-primary" disabled={enregistrementStock || produits.length === 0}>
                          {enregistrementStock ? 'Enregistrement…' : typeMouvement === 'ENTREE' ? '＋ Enregistrer l’entrée' : '− Enregistrer la sortie'}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="content-card">
                    <div className="card-heading"><div><span className="eyebrow">SURVEILLANCE</span><h2>Produits à surveiller</h2></div><span className="result-count">{produitsEnAlerte.length} alerte(s)</span></div>
                    {produitsEnAlerte.length === 0 ? (
                      <div className="empty-state"><span>✓</span><h3>Tout semble en ordre</h3><p>Aucun produit n'est au seuil d'alerte ou en dessous.</p></div>
                    ) : (
                      <div className="table-wrap"><table><thead><tr><th>Produit</th><th>Catégorie</th><th>Stock disponible</th><th>Seuil d'alerte</th><th>État</th></tr></thead><tbody>
                        {produitsEnAlerte.map((produit) => <tr key={produit.id}><td className="table-product">{produit.nom}</td><td>{produit.categorie || '—'}</td><td><strong>{stockDisponible(produit)} {produit.unite || 'pièce'}</strong></td><td>{Number(produit.seuil_alerte ?? 5)}</td><td><span className="stock-pill low">{stockDisponible(produit) === 0 ? 'Rupture' : 'Stock faible'}</span></td></tr>)}
                      </tbody></table></div>
                    )}
                  </div>

                  <div className="content-card">
                    <div className="card-heading"><div><span className="eyebrow">JOURNAL DU STOCK</span><h2>Historique des mouvements</h2></div><span className="result-count">{mouvements.length} mouvement(s)</span></div>
                    {chargementStock && mouvements.length === 0 ? (
                      <p className="muted-text">Chargement de l'historique…</p>
                    ) : mouvements.length === 0 ? (
                      <div className="empty-state"><span>↕</span><h3>Aucun mouvement enregistré</h3><p>Les entrées et sorties enregistrées apparaîtront ici.</p></div>
                    ) : (
                      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Produit</th><th>Type</th><th>Quantité</th><th>Motif</th></tr></thead><tbody>
                        {mouvements.map((mouvement) => <tr key={mouvement.id}>
                          <td>{mouvement.date_mouvement ? new Date(mouvement.date_mouvement).toLocaleString('fr-FR') : '—'}</td>
                          <td><div className="table-product-cell"><div><strong>{mouvement.produit_nom}</strong>{mouvement.reference && <small>Réf. : {mouvement.reference}</small>}</div></div></td>
                          <td><span className={`stock-pill ${mouvement.type === 'ENTREE' ? '' : 'low'}`}>{mouvement.type === 'ENTREE' ? 'Entrée' : 'Sortie'}</span></td>
                          <td><strong>{mouvement.type === 'ENTREE' ? '+' : '−'}{mouvement.quantite} {mouvement.unite || 'pièce'}(s)</strong></td>
                          <td>{mouvement.motif || '—'}</td>
                        </tr>)}
                      </tbody></table></div>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          <footer className="page-footer"><span>© 2026 GestionPPN</span><span>Gestion simple, stock maîtrisé.</span></footer>
        </main>
      </div>
    </div>
  );
}

export default App;
