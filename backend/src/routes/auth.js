// ======================================================
// GESTION PPN - AUTHENTIFICATION
// Fichier : backend/src/routes/auth.js
// ======================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const pool = require('../database');

const router = express.Router();

// Limiter les tentatives de connexion.
const limiteConnexion = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Trop de tentatives. Réessaie dans 15 minutes.'
    }
});

// Vérifier la configuration du JWT.
function obtenirSecretJWT() {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error(
            'JWT_SECRET doit contenir au moins 32 caractères.'
        );
    }

    return secret;
}

// ======================================================
// POST /api/auth/login
// Connexion par email et mot de passe
// ======================================================

router.post('/login', limiteConnexion, async (req, res) => {
    try {
        const email = String(req.body.email || '')
            .trim()
            .toLowerCase();

        const motDePasse = req.body.mot_de_passe;

        if (
            !email ||
            typeof motDePasse !== 'string' ||
            !motDePasse
        ) {
            return res.status(400).json({
                success: false,
                message: 'Email et mot de passe obligatoires.'
            });
        }

        if (email.length > 150 || motDePasse.length > 128) {
            return res.status(400).json({
                success: false,
                message: 'Identifiants invalides.'
            });
        }

        const [utilisateurs] = await pool.execute(
            `SELECT
                id,
                nom,
                prenom,
                email,
                mot_de_passe,
                role,
                actif
             FROM utilisateurs
             WHERE email = ?
             LIMIT 1`,
            [email]
        );

        if (utilisateurs.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Email ou mot de passe incorrect.'
            });
        }

        const utilisateur = utilisateurs[0];

        if (!utilisateur.actif) {
            return res.status(403).json({
                success: false,
                message: 'Ce compte est désactivé.'
            });
        }

        const motDePasseValide = await bcrypt.compare(
            motDePasse,
            utilisateur.mot_de_passe
        );

        if (!motDePasseValide) {
            return res.status(401).json({
                success: false,
                message: 'Email ou mot de passe incorrect.'
            });
        }

        const secret = obtenirSecretJWT();

        const token = jwt.sign(
            {
                role: utilisateur.role
            },
            secret,
            {
                subject: String(utilisateur.id),
                expiresIn: '2h',
                issuer: 'gestion-ppn',
                audience: 'gestion-ppn-client'
            }
        );

        return res.json({
            success: true,
            message: 'Connexion réussie.',
            token,
            utilisateur: {
                id: utilisateur.id,
                nom: utilisateur.nom,
                prenom: utilisateur.prenom,
                email: utilisateur.email,
                role: utilisateur.role
            }
        });
    } catch (error) {
        console.error('Erreur connexion :', error.message);

        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la connexion.'
        });
    }
});

// ======================================================
// MIDDLEWARE D'AUTHENTIFICATION
// ======================================================

function authentifier(req, res, next) {
    try {
        const autorisation = req.headers.authorization || '';

        if (!autorisation.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authentification nécessaire.'
            });
        }

        const token = autorisation.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Jeton manquant.'
            });
        }

        const secret = obtenirSecretJWT();

        const donnees = jwt.verify(token, secret, {
            issuer: 'gestion-ppn',
            audience: 'gestion-ppn-client'
        });

        if (!donnees.sub || !donnees.role) {
            return res.status(401).json({
                success: false,
                message: 'Jeton invalide.'
            });
        }

        req.utilisateur = {
            id: donnees.sub,
            role: donnees.role
        };

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Session invalide ou expirée. Reconnecte-toi.'
        });
    }
}

// ======================================================
// GET /api/auth/me
// Vérifier la session et récupérer le profil actuel
// ======================================================

router.get('/me', authentifier, async (req, res) => {
    try {
        const [utilisateurs] = await pool.execute(
            `SELECT id, nom, prenom, email, role, actif
             FROM utilisateurs
             WHERE id = ?
             LIMIT 1`,
            [req.utilisateur.id]
        );

        if (
            utilisateurs.length === 0 ||
            !utilisateurs[0].actif
        ) {
            return res.status(401).json({
                success: false,
                message: 'Compte introuvable ou désactivé.'
            });
        }

        return res.json({
            success: true,
            utilisateur: utilisateurs[0]
        });
    } catch (error) {
        console.error('Erreur vérification session :', error.message);

        return res.status(500).json({
            success: false,
            message: 'Impossible de vérifier la session.'
        });
    }
});

router.authentifier = authentifier;
module.exports = router;
