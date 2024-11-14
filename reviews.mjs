import express from "express";
import pkg from "sqlite3";

const { Database } = pkg;
const db = new Database("./movies.db");
const router = express.Router();

// Función helper para convertir db.run en una promesa
const runQuery = (query, params) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
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
    let { user_id} = req.cookies;

    console.log('Cuerpo de la solicitud:', req.body);
    console.log('Movie ID:', movieId);


    // Convertir `userId` y `rating` a números
    user_id = parseInt(user_id, 10);
    rating = parseInt(rating, 10);


    try {
        const query = `INSERT INTO movie_user (user_id, movie_id, rating, opinion) VALUES (?, ?, ?, ?)`;
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

router.post('/movies/:id/review', async (req, res) => {
    const { userId, rating, opinion } = req.body; // Extrae los datos del cuerpo de la solicitud
    const movieId = req.params.id; // Obtiene el ID de la película de los parámetros

    try {
        // Llama a tu función para agregar la reseña
        await addReview(userId, movieId, rating, opinion);
        res.status(200).json({ message: 'Reseña agregada con éxito' });
    } catch (error) {
        console.error('Error al agregar la reseña:', error);
        res.status(500).json({ message: 'Error al agregar la reseña' });
    }
});

export async function addReview(userId, movieId, rating, opinion) {
    const sql = 'INSERT INTO movie_user (user_id, movie_id, rating, opinion) VALUES (?, ?, ?, ?)';
    const params = [userId, movieId, rating, opinion];

    // Ejecuta la consulta SQL
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            if (error) {
                return reject(error); // Rechaza la promesa si hay un error
            }
            resolve(this.changes); // Resuelve la promesa con el número de filas afectadas
        });
    });
}


export default router;
