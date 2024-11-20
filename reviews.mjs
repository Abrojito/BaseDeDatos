import express from "express";
import pkg from "sqlite3";

const { Database } = pkg;
const db = new Database("./movies.db");
const router = express.Router();

// Función helper para convertir db.run en una promesa
const runQuery = (query, params) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
};

// Ruta para agregar una reseña
router.post('/:movieId/review', async (req, res) => {
    const { movieId } = req.params;
    let { rating, opinion } = req.body;
    let { user_id } = req.cookies;

    console.log('Cuerpo de la solicitud:', req.body);
    console.log('Movie ID:', movieId);
    user_id = parseInt(user_id, 10);
    rating = parseInt(rating, 10);

    try {
        const query = `INSERT INTO movie_user (id, user_id, movie_id, rating, review) VALUES (NULL, ?, ?, ?, ?)`;
        const values = [user_id, movieId, rating, opinion];

        const result = await runQuery(query, values);

        res.status(201).json({
            message: 'Reseña agregada exitosamente.',
            reviewId: result.lastID

        });
    } catch (err) {
        console.error("Error al agregar la reseña:", err);
        return res.status(500).json({
            message: 'Error al agregar la reseña.',
            error: err.message
        });
    }
});

// Ejemplo de ruta para mostrar la película
router.get('/movies/:id', async (req, res) => {
    const movieId = req.params.id;
    const userId = req.session.userId; // Asegúrate de que el userId esté en la sesión

    // Lógica para obtener la película desde la base de datos
    const movie = await getMovieById(movieId); // Tu función para obtener la película

    // Renderiza la vista pasando la película y el userId
    res.render('pelicula', { movie, userId }); // Pasa userId aquí
});

export async function addReview(userId, movieId, rating, opinion) {
    const sql = 'INSERT INTO movie_user (id, user_id, movie_id, rating, review) VALUES (NULL, ?, ?, ?, ?)';
    const params = [userId, movieId, rating, opinion];

    // Ejecuta la consulta SQL
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            if (error) {
                return reject(error);
            }
            resolve(this.changes);
        });
    });
}


export default router;