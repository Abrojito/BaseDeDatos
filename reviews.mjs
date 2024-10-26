import pkg from "sqlite3";

const { Database } = pkg;
const db = new Database("./movies.db");

// Obtener la lista de películas que le gustan al usuario junto con sus opiniones
async function getMovieUserList(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT m.title, mu.rating, mu.opinion
            FROM movie_user mu
            JOIN movies m ON mu.movie_id = m.id
            WHERE mu.user_id = ?
        `;

        db.all(query, [userId], (error, rows) => {
            if (error) {
                reject(error);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Función para agregar una opinión
async function addReview(userId, movieId, rating, opinion) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO movie_user (user_id, movie_id, rating, opinion)
            VALUES (?, ?, ?, ?)
        `;

        db.run(query, [userId, movieId, rating, opinion], function(error) {
            if (error) {
                reject(error);
            } else {
                resolve(this.lastID); // Devuelve el ID de la nueva entrada
            }
        });
    });
}

// Función para actualizar una opinión
async function updateReview(reviewId, rating, opinion) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE movie_user
            SET rating = ?, opinion = ?
            WHERE id = ?
        `;

        db.run(query, [rating, opinion, reviewId], function(error) {
            if (error) {
                reject(error);
            } else {
                resolve(this.changes); // Devuelve el número de cambios realizados
            }
        });
    });
}

// Función para borrar una opinión
async function deleteReview(reviewId) {
    return new Promise((resolve, reject) => {
        const query = `
            DELETE FROM movie_user
            WHERE id = ?
        `;

        db.run(query, [reviewId], function(error) {
            if (error) {
                reject(error);
            } else {
                resolve(this.changes); // Devuelve el número de cambios realizados
            }
        });
    });
}

export { getMovieUserList, addReview, updateReview, deleteReview };
