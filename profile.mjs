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
                r.*
            FROM movie m
                     LEFT JOIN movie_user r ON m.movie_id = r.movie_id AND r.user_id = ?
            WHERE r.rating IS NOT NULL OR r.review IS NOT NULL ORDER BY r.id
        `, userId);

        res.render('profile', {
            user,
            reviews: ratingsAndReviews,
            error: null,
        });

    } catch (error) {
        console.error('Error al cargar el perfil:', error);
        res.status(500).render('error', {
            message: 'Error al cargar el perfil'
        });
    }
});

// Agregar o actualizar puntuación de película
router.patch('/rating', async (req, res) => {
    const userId = req.cookies.user_id;
    const { rating, reviewId } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Puntuación inválida. Debe ser entre 1 y 5' });
    }

    try {
        await db.run(`
            UPDATE movie_user
            SET rating = ?
            WHERE id = ?;
            
        `, [rating, reviewId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar la puntuación:', error);
        res.status(500).json({ error: 'Error al guardar la puntuación' });
    }
});

// Actualizar reseña de película
router.patch('/review', async (req, res) => {
    const userId = req.cookies.user_id;
    const { reviewId, review } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    if (!reviewId || !review || review.trim().length === 0) {
        return res.status(400).json({ error: 'La reseña no puede estar vacía y se requiere el reviewId' });
    }

    try {
        const result = await db.run(`
            UPDATE movie_user
            SET review = ?
            WHERE id = ?;
        `, [review.trim(), reviewId]);

        if (result.changes === 0) {
            // Si no se encuentra una fila para actualizar, devuelve un error
            return res.status(404).json({ error: 'No se encontró la reseña para actualizar' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error al actualizar la reseña:', error);
        res.status(500).json({ error: 'Error al actualizar la reseña' });
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

export default router;

export class getMovieUserList {
}

export class addReview {
}