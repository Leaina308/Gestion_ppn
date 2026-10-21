// ======================================================
// GESTION PPN - BACKEND EXPRESS + MARIADB
// Fichier : backend/src/server.js
// ======================================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./database');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================================
// 1. CONFIGURATION
// ======================================================

app.use(cors({
    origin: 'http://localhost:5173'
}));

app.use(express.json({ limit: '5mb' }));
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes.authentifier);

// ======================================================
// 2. ROUTE D'ACCUEIL
// ======================================================

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Bienvenue dans l’API Gestion PPN !',
        status: 'Serveur Express opérationnel'
    });
});

// ======================================================
// 3. TESTER LE BACKEND
// ======================================================

app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Le backend fonctionne correctement !'
    });
});

// ======================================================
// 4. TESTER LA CONNEXION À MARIADB
// ======================================================

app.get('/api/test-db', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT DATABASE() AS database_name, VERSION() AS database_version'
        );

        res.json({
            success: true,
            message: 'Connexion à MariaDB réussie !',
            database: rows[0].database_name,
            version: rows[0].database_version
        });
    } catch (error) {
        console.error('Erreur de connexion MariaDB :', error.message);

        res.status(500).json({
            success: false,
            message: 'Impossible de se connecter à la base de données.'
        });
    }
});

// ======================================================
// 5. RÉCUPÉRER LES PRODUITS ACTIFS
// ======================================================

app.get('/api/produits', async (req, res) => {
    try {
        const sql = `
            SELECT
                p.id,
                p.categorie_id,
                p.nom,
                p.description,
                p.reference,
                p.code_barres,
                p.image,
                p.prix_achat,
                p.prix_vente,
                p.stock_physique,
                p.stock_reserve,
                p.seuil_alerte,
                (p.stock_physique - p.stock_reserve)
                    AS stock_disponible,
                p.unite,
                c.nom AS categorie
            FROM produits p
            INNER JOIN categories c
                ON p.categorie_id = c.id
            WHERE p.actif = TRUE
            ORDER BY p.nom ASC
        `;

        const [produits] = await pool.query(sql);

        res.json({
            success: true,
            total: produits.length,
            produits
        });
    } catch (error) {
        console.error('Erreur récupération produits :', error.message);

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des produits.'
        });
    }
});

// ======================================================
// 6. RÉCUPÉRER LES CATÉGORIES ACTIVES
// ======================================================

app.get('/api/categories', async (req, res) => {
    try {
        const sql = `
            SELECT id, nom, description, image
            FROM categories
            WHERE actif = TRUE
            ORDER BY nom ASC
        `;

        const [categories] = await pool.query(sql);

        res.json({
            success: true,
            total: categories.length,
            categories
        });
    } catch (error) {
        console.error('Erreur récupération catégories :', error.message);

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des catégories.'
        });
    }
});

// ======================================================
// 7. AJOUTER UNE CATÉGORIE
// ======================================================

app.post('/api/categories', async (req, res) => {
    try {
        const { nom, description, image } = req.body;

        if (typeof nom !== 'string' || !nom.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Le nom de la catégorie est obligatoire.'
            });
        }

        const nomCategorie = nom.trim();

        const [existantes] = await pool.query(
            'SELECT id FROM categories WHERE LOWER(nom) = LOWER(?)',
            [nomCategorie]
        );

        if (existantes.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Cette catégorie existe déjà.'
            });
        }

        const [resultat] = await pool.query(
            `INSERT INTO categories (nom, description, image, actif)
             VALUES (?, ?, ?, TRUE)`,
            [
                nomCategorie,
                description || null,
                image || null
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Catégorie ajoutée avec succès.',
            id: resultat.insertId
        });
    } catch (error) {
        console.error('Erreur ajout catégorie :', error.message);

        res.status(500).json({
            success: false,
            message: 'Erreur lors de l’ajout de la catégorie.'
        });
    }
});

// ======================================================
// 8. MODIFIER UNE CATÉGORIE
// ======================================================

app.put('/api/categories/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { nom, description, image } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Identifiant de catégorie invalide.'
            });
        }

        if (typeof nom !== 'string' || !nom.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Le nom de la catégorie est obligatoire.'
            });
        }

        const [categories] = await pool.query(
            'SELECT id FROM categories WHERE id = ? AND actif = TRUE',
            [id]
        );

        if (categories.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Catégorie introuvable ou désactivée.'
            });
        }

        const nomCategorie = nom.trim();

        const [existantes] = await pool.query(
            `SELECT id FROM categories
             WHERE LOWER(nom) = LOWER(?) AND id != ?`,
            [nomCategorie, id]
        );

        if (existantes.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ce nom est déjà utilisé par une autre catégorie.'
            });
        }

        await pool.query(
            `UPDATE categories
             SET nom = ?, description = ?, image = ?
             WHERE id = ? AND actif = TRUE`,
            [
                nomCategorie,
                description || null,
                image || null,
                id
            ]
        );

        res.json({
            success: true,
            message: 'Catégorie modifiée avec succès.'
        });
    } catch (error) {
        console.error('Erreur modification catégorie :', error.message);

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification de la catégorie.'
        });
    }
});

// ======================================================
// 9. DÉSACTIVER UNE CATÉGORIE
// ======================================================

app.delete('/api/categories/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Identifiant de catégorie invalide.'
            });
        }

        const [categories] = await pool.query(
            'SELECT id FROM categories WHERE id = ? AND actif = TRUE',
            [id]
        );

        if (categories.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Catégorie introuvable ou déjà désactivée.'
            });
        }

        const [produits] = await pool.query(
            `SELECT COUNT(*) AS total
             FROM produits
             WHERE categorie_id = ? AND actif = TRUE`,
            [id]
        );

        if (Number(produits[0].total) > 0) {
            return res.status(409).json({
                success: false,
                message:
                    'Impossible de désactiver cette catégorie : des produits actifs lui sont associés.'
            });
        }

        await pool.query(
            'UPDATE categories SET actif = FALSE WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Catégorie désactivée avec succès.'
        });
    } catch (error) {
        console.error('Erreur désactivation catégorie :', error.message);

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la désactivation de la catégorie.'
        });
    }
});

// ======================================================
// 10. AJOUTER UN PRODUIT
// ======================================================

app.post('/api/produits', async (req, res) => {
    try {
        const {
            categorie_id,
            nom,
            description,
            reference,
            code_barres,
            image,
            prix_achat,
            prix_vente,
            stock_physique,
            seuil_alerte,
            unite
        } = req.body;

        if (
            !categorie_id ||
            typeof nom !== 'string' ||
            !nom.trim() ||
            prix_vente === undefined ||
            prix_vente === null ||
            prix_vente === ''
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'La catégorie, le nom et le prix de vente sont obligatoires.'
            });
        }

        const categorieId = Number(categorie_id);
        const achat = Number(prix_achat ?? 0);
        const vente = Number(prix_vente);
        const stock = Number(stock_physique ?? 0);
        const seuil = Number(seuil_alerte ?? 5);

        if (
            !Number.isInteger(categorieId) ||
            categorieId <= 0 ||
            !Number.isFinite(achat) ||
            !Number.isFinite(vente) ||
            !Number.isInteger(stock) ||
            !Number.isInteger(seuil) ||
            achat < 0 ||
            vente < 0 ||
            stock < 0 ||
            seuil < 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Les prix doivent être positifs et les quantités des entiers positifs ou nuls.'
            });
        }

        const [categories] = await pool.query(
            'SELECT id FROM categories WHERE id = ? AND actif = TRUE',
            [categorieId]
        );

        if (categories.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'La catégorie sélectionnée n’existe pas.'
            });
        }

        const sql = `
            INSERT INTO produits (
                categorie_id,
                nom,
                description,
                reference,
                code_barres,
                image,
                prix_achat,
                prix_vente,
                stock_physique,
                stock_reserve,
                seuil_alerte,
                unite,
                actif
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, TRUE)
        `;

        const [resultat] = await pool.query(sql, [
            categorieId,
            nom.trim(),
            description || null,
            reference || null,
            code_barres || null,
            image || null,
            achat,
            vente,
            stock,
            seuil,
            unite || 'pièce'
        ]);

        res.status(201).json({
            success: true,
            message: 'Produit ajouté avec succès.',
            id: resultat.insertId
        });
    } catch (error) {
        console.error('Erreur ajout produit :', error.message);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Cette référence ou ce code-barres existe déjà.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de l’ajout du produit.'
        });
    }
});

// ======================================================
// 11. MODIFIER UN PRODUIT
// ======================================================

app.put('/api/produits/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Identifiant de produit invalide.'
            });
        }

        const {
            categorie_id,
            nom,
            description,
            reference,
            code_barres,
            image,
            prix_achat,
            prix_vente,
            stock_physique,
            seuil_alerte,
            unite
        } = req.body;

        if (
            !categorie_id ||
            typeof nom !== 'string' ||
            !nom.trim() ||
            prix_vente === undefined ||
            prix_vente === null ||
            prix_vente === ''
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'La catégorie, le nom et le prix de vente sont obligatoires.'
            });
        }

        const categorieId = Number(categorie_id);
        const achat = Number(prix_achat ?? 0);
        const vente = Number(prix_vente);
        const stock = Number(stock_physique ?? 0);
        const seuil = Number(seuil_alerte ?? 5);

        if (
            !Number.isInteger(categorieId) ||
            categorieId <= 0 ||
            !Number.isFinite(achat) ||
            !Number.isFinite(vente) ||
            !Number.isInteger(stock) ||
            !Number.isInteger(seuil) ||
            achat < 0 ||
            vente < 0 ||
            stock < 0 ||
            seuil < 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Les prix doivent être positifs et les quantités des entiers positifs ou nuls.'
            });
        }

        const [produitsExistants] = await pool.query(
            'SELECT id FROM produits WHERE id = ? AND actif = TRUE',
            [id]
        );

        if (produitsExistants.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produit introuvable ou désactivé.'
            });
        }

        const [categories] = await pool.query(
            'SELECT id FROM categories WHERE id = ? AND actif = TRUE',
            [categorieId]
        );

        if (categories.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'La catégorie sélectionnée n’existe pas.'
            });
        }

        const sql = `
            UPDATE produits
            SET
                categorie_id = ?,
                nom = ?,
                description = ?,
                reference = ?,
                code_barres = ?,
                image = ?,
                prix_achat = ?,
                prix_vente = ?,
                stock_physique = ?,
                seuil_alerte = ?,
                unite = ?
            WHERE id = ? AND actif = TRUE
        `;

        await pool.query(sql, [
            categorieId,
            nom.trim(),
            description || null,
            reference || null,
            code_barres || null,
            image || null,
            achat,
            vente,
            stock,
            seuil,
            unite || 'pièce',
            id
        ]);

        res.json({
            success: true,
            message: 'Produit modifié avec succès.'
        });
    } catch (error) {
        console.error('Erreur modification produit :', error.message);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Cette référence ou ce code-barres existe déjà.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification du produit.'
        });
    }
});

// ======================================================
// 12. DÉSACTIVER UN PRODUIT
// ======================================================

app.delete('/api/produits/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Identifiant de produit invalide.'
            });
        }

        const [resultat] = await pool.query(
            `UPDATE produits
             SET actif = FALSE
             WHERE id = ? AND actif = TRUE`,
            [id]
        );

        if (resultat.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produit introuvable ou déjà désactivé.'
            });
        }

        res.json({
            success: true,
            message: 'Produit désactivé avec succès.'
        });
    } catch (error) {
        console.error('Erreur désactivation produit :', error.message);

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la désactivation du produit.'
        });
    }
});

// ======================================================
// 13. HISTORIQUE DES MOUVEMENTS DE STOCK
// ======================================================

app.get('/api/mouvements-stock', async (req, res) => {
    try {
        const sql = `
            SELECT
                m.id,
                m.produit_id,
                p.nom AS produit_nom,
                p.reference,
                p.unite,
                m.type,
                m.quantite,
                m.motif,
                m.date_mouvement
            FROM mouvements_stock m
            INNER JOIN produits p
                ON p.id = m.produit_id
            ORDER BY m.date_mouvement DESC, m.id DESC
        `;

        const [mouvements] = await pool.query(sql);

        res.json({
            success: true,
            total: mouvements.length,
            mouvements
        });
    } catch (error) {
        console.error('Erreur historique stock :', error.message);

        res.status(500).json({
            success: false,
            message:
                'Impossible de récupérer l’historique du stock. Vérifiez que la table mouvements_stock existe.'
        });
    }
});

// ======================================================
// 14. ENREGISTRER UNE ENTRÉE OU UNE SORTIE DE STOCK
// ======================================================

app.post('/api/mouvements-stock', async (req, res) => {
    const produitId = Number(req.body.produit_id);
    const quantite = Number(req.body.quantite);
    const type = String(req.body.type || '').toUpperCase();
    const motif =
        typeof req.body.motif === 'string'
            ? req.body.motif.trim()
            : '';

    // Vérifier l'identifiant du produit.
    if (!Number.isInteger(produitId) || produitId <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Choisissez un produit valide.'
        });
    }

    // Vérifier la quantité.
    if (!Number.isInteger(quantite) || quantite <= 0) {
        return res.status(400).json({
            success: false,
            message: 'La quantité doit être un entier supérieur à zéro.'
        });
    }

    // Vérifier le type de mouvement.
    if (!['ENTREE', 'SORTIE'].includes(type)) {
        return res.status(400).json({
            success: false,
            message: 'Le type doit être ENTREE ou SORTIE.'
        });
    }

    if (motif.length > 255) {
        return res.status(400).json({
            success: false,
            message: 'Le motif ne doit pas dépasser 255 caractères.'
        });
    }

    let connexion;

    try {
        // Ouvrir une connexion dédiée à la transaction.
        connexion = await pool.getConnection();

        await connexion.beginTransaction();

        // Verrouiller le produit pendant le mouvement.
        const [produitsTrouves] = await connexion.query(
            `SELECT
                id,
                nom,
                stock_physique,
                stock_reserve,
                actif
             FROM produits
             WHERE id = ?
             FOR UPDATE`,
            [produitId]
        );

        if (
            produitsTrouves.length === 0 ||
            !produitsTrouves[0].actif
        ) {
            const erreur = new Error(
                'Produit introuvable ou désactivé.'
            );
            erreur.statusCode = 404;
            throw erreur;
        }

        const produit = produitsTrouves[0];

        const stockPhysique = Number(produit.stock_physique || 0);
        const stockReserve = Number(produit.stock_reserve || 0);

        let nouveauStock;

        if (type === 'ENTREE') {
            // Une entrée augmente le stock physique.
            nouveauStock = stockPhysique + quantite;
        } else {
            // Une sortie ne peut pas dépasser le stock disponible.
            const disponible = stockPhysique - stockReserve;

            if (quantite > disponible) {
                const erreur = new Error(
                    `Stock disponible insuffisant. Quantité disponible : ${Math.max(0, disponible)}.`
                );

                erreur.statusCode = 400;
                throw erreur;
            }

            nouveauStock = stockPhysique - quantite;
        }

        // Mettre à jour le stock physique.
        await connexion.query(
            `UPDATE produits
             SET stock_physique = ?
             WHERE id = ?`,
            [nouveauStock, produitId]
        );

        // Ajouter le mouvement à l'historique.
        await connexion.query(
            `INSERT INTO mouvements_stock
                (produit_id, type, quantite, motif)
             VALUES (?, ?, ?, ?)`,
            [
                produitId,
                type,
                quantite,
                motif || null
            ]
        );

        // Valider les deux opérations ensemble.
        await connexion.commit();

        res.status(201).json({
            success: true,
            message:
                type === 'ENTREE'
                    ? 'Entrée de stock enregistrée avec succès.'
                    : 'Sortie de stock enregistrée avec succès.',
            produit_id: produitId,
            stock_physique: nouveauStock,
            stock_disponible: nouveauStock - stockReserve
        });
    } catch (error) {
        // Annuler les opérations si une erreur survient.
        if (connexion) {
            try {
                await connexion.rollback();
            } catch (rollbackError) {
                console.error(
                    'Erreur lors de l’annulation :',
                    rollbackError.message
                );
            }
        }

        console.error(
            'Erreur mouvement stock :',
            error.message
        );

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : 'Erreur lors de l’enregistrement du mouvement de stock.'
        });
    } finally {
        // Toujours libérer la connexion.
        if (connexion) {
            connexion.release();
        }
    }
});

// ======================================================
// 15. DÉMARRAGE DU SERVEUR
// ======================================================

async function startServer() {
    try {
        const connexion = await pool.getConnection();

        console.log('Connexion à MariaDB réussie !');

        connexion.release();

        app.listen(PORT, () => {
            console.log(
                `Serveur démarré sur http://localhost:${PORT}`
            );
        });
    } catch (error) {
        console.error(
            'Impossible de démarrer le serveur :',
            error.message
        );

        process.exit(1);
    }
}

startServer();