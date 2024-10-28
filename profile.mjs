import express from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import cookieParser from 'cookie-parser';

const router = express.Router();

// Inicialización de la base de datos
let db;
const initializeDb = async () => {
    db = await open({
        filename: './movies.db',
        driver: sqlite3.Database
    });
};

initializeDb().catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

// Middleware para manejar cookies
router.use(cookieParser());

// Obtener el perfil del usuario con sus puntuaciones y reseñas
router.get('/', async (req, res) => {
    const userId = req.cookies.user_id;

    if (!userId) {
        return res.redirect('/login');
    }

    try {
        const user = await db.get(`
            SELECT user_id, user_username, user_email
            FROM user
            WHERE user_id = ?
        `, userId);

        if (!user) {
            res.clearCookie('user_id');
            return res.redirect('/login');
        }

        // Obtener las puntuaciones y reseñas del usuario
        const ratingsAndReviews = await db.all(`
            SELECT
                m.movie_id,
                m.title,
                r.rating,
                r.opinion AS review
            FROM movie m
                     LEFT JOIN movie_user r ON m.movie_id = r.movie_id AND r.user_id = ?
            WHERE r.rating IS NOT NULL OR r.opinion IS NOT NULL
        `, userId);


        res.render('profile', {
            user,
            ratingsAndReviews,
            error: null
        });

    } catch (error) {
        console.error('Error al cargar el perfil:', error);
        res.status(500).render('error', {
            message: 'Error al cargar el perfil'
        });
    }
});

// Agregar o actualizar puntuación de película
router.post('/rating', async (req, res) => {
    const userId = req.cookies.user_id;
    const { movieId, rating } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    if (!movieId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Puntuación inválida. Debe ser entre 1 y 5' });
    }

    try {
        await db.run(`
            INSERT INTO movie_user (user_id, movie_id, rating, date)
            VALUES (?, ?, ?, DATETIME('now'))
                ON CONFLICT(user_id, movie_id) 
            DO UPDATE SET rating = ?, date = DATETIME('now')
        `, [userId, movieId, rating, rating]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar la puntuación:', error);
        res.status(500).json({ error: 'Error al guardar la puntuación' });
    }
});

// Agregar o actualizar reseña de película
router.post('/review', async (req, res) => {
    const userId = req.cookies.user_id;
    const { movieId, review } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    if (!movieId || !review || review.trim().length === 0) {
        return res.status(400).json({ error: 'La reseña no puede estar vacía' });
    }

    try {
        await db.run(`
            INSERT INTO user_reviews (user_id, movie_id, review, date)
            VALUES (?, ?, ?, DATETIME('now'))
                ON CONFLICT(user_id, movie_id) 
            DO UPDATE SET review = ?, date = DATETIME('now')
        `, [userId, movieId, review, review]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar la reseña:', error);
        res.status(500).json({ error: 'Error al guardar la reseña' });
    }
});

// Eliminar puntuación
router.delete('/rating/:movieId', async (req, res) => {
    const userId = req.cookies.user_id;
    const { movieId } = req.params;

    if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        await db.run(`
            DELETE FROM movie_user
            WHERE user_id = ? AND movie_id = ?
        `, [userId, movieId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar la puntuación:', error);
        res.status(500).json({ error: 'Error al eliminar la puntuación' });
    }
});

// Eliminar reseña
router.delete('/review/:movieId', async (req, res) => {
    const userId = req.cookies.user_id;
    console.log(req.cookies);
    const { movieId } = req.params;

    if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        await db.run(`
            DELETE FROM user_reviews
            WHERE user_id = ? AND movie_id = ?
        `, [userId, movieId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar la reseña:', error);
        res.status(500).json({ error: 'Error al eliminar la reseña' });
    }
});
/*// Ruta para agregar una reseña
router.post('/movies/:movieId/review', async (req, res) => {
    const userId = req.cookies.user_id; // Asegúrate de que el usuario esté autenticado
    const { movieId } = req.params;
    const { rating, opinion } = req.body; // Cambié 'review' por 'opinion' según tu tabla

    if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        await db.run(`
            INSERT INTO movie_user (user_id, movie_id, rating, opinion)
            VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id, movie_id) 
            DO UPDATE SET rating = ?, opinion = ?
        `, [userId, movieId, rating, opinion, rating, opinion]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar la reseña:', error);
        res.status(500).json({ error: 'Error al guardar la reseña' });
    }
});*/

export default router;

export class getMovieUserList {
}

export class addReview {
}