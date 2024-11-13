import express from "express";
import pkg from "sqlite3";
import { user } from "./user.mjs";
import cookieParser from "cookie-parser";
import profile from "./profile.mjs";
import reviews from "./reviews.mjs";
import { searchMovies, searchPeople } from "./search.js";

const { Database } = pkg;
const app = express();
const port = process.env.PORT || 3009;

// Serve static files from the "views" directory
app.use(express.static("views"));

// Middleware para parsear JSON
app.use(express.json());
app.use(cookieParser());

// Database setup
//  with proper async initialization

// Path completo de la base de datos movies.db
const db = new Database("./movies.db");

// Configurar el motor de plantillas EJS
app.set("view engine", "ejs");

// Redirecciona todas las rutas que comiencen con /user
app.use("/user", user);
// Routes
app.use("/perfil", profile);

// Ruta para la página de inicio
app.get("/home", (req, res) => {
    res.render("index");
});

// Ruta para el formulario de login
app.get("/login", (req, res) => {
    res.render("login");
});

// Ruta para procesar el formulario de login
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    // Consulta para verificar al usuario en la BD
    const query = `SELECT * FROM user WHERE user_username = ? AND user_password = ?`;

    db.get(query, [username, password], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error al verificar el usuario.");
        }
        if (row) {
            // Si el usuario es válido, cookie para mantener la sesión
            res.cookie("user_id", row.user_id);
            res.redirect("/"); // Redirigir al home o donde quieras
        } else {
            res.status(401).send("Usuario o contraseña incorrectos.");
        }
    });
});

// Ruta para mostrar el formulario de registro
app.get("/register", (req, res) => {
    res.render("register");
});

// Rutas
app.use("/movies", reviews); // Usa las rutas de reseñas

// Ruta para el logout
app.get("/logout", (req, res) => {
    res.clearCookie("user_id"); // Elimina la cookie de usuario
    res.redirect("/login"); // Redirige a la página de login
});

// Ruta para la página de inicio
app.get("/", (req, res) => {
    if (!req.cookies?.user_id) {
        return res.redirect("/login"); // Redirige al login si no hay usuario autenticado
    }
    return db.all(
        "SELECT * FROM user WHERE user_id = ?",
        [req.cookies?.user_id],
        (error, rows) => {
            if (error || rows.length == 0) {
                res.clearCookie("user_id");
                return res
                    .status(500)
                    .send(
                        error?.message ??
                        `Usuario con id ${req.cookies?.user_id} no encontrado. Refresque la página para elegir otro usuario.`
                    );
            }
            return res.render("index", { user: rows[0] }); // Renderiza la vista del usuario autenticado
        }
    );
});

// Ruta para buscar películas, actores y directores
app.get("/buscar", (req, res) => {
    const searchTerm = req.query.q;

    // Realizar la búsqueda en las tablas movie, person (para actores y directores)
    const query = `
        SELECT 'movie' AS type, movie_id AS id, title AS name FROM movie WHERE title LIKE ?
        UNION
        SELECT 'actor' AS type, person_id AS id, person_name AS name FROM person
        WHERE person_id IN (SELECT person_id FROM movie_cast) AND person_name LIKE ?
        UNION
        SELECT 'director' AS type, person_id AS id, person_name AS name FROM person
        WHERE person_id IN (SELECT person_id FROM movie_crew WHERE job = 'Director') AND person_name LIKE ?;
    `;

    db.all(
        query,
        [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`],
        (err, rows) => {
            if (err) {
                console.error(err);
                res.status(500).send("Error en la búsqueda.");
            }

            res.render("resultado", { results: rows });
        }
    );
});

// Ruta para la página de datos de una película particular
app.get("/pelicula/:id", (req, res) => {
    const movieId = req.params.id;
    const userId = req.cookies.user_id;

    // Consulta SQL para obtener los datos de la película, elenco y crew
    const query = `
        SELECT
            movie.*,
            actor.person_name as actor_name,
            actor.person_id as actor_id,
            crew_member.person_name as crew_member_name,
            crew_member.person_id as crew_member_id,
            movie_cast.character_name,
            movie_cast.cast_order,
            department.department_name,
            movie_crew.job
        FROM movie
                 LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
                 LEFT JOIN person as actor ON movie_cast.person_id = actor.person_id
                 LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
                 LEFT JOIN department ON movie_crew.department_id = department.department_id
                 LEFT JOIN person as crew_member ON crew_member.person_id = movie_crew.person_id
        WHERE movie.movie_id = ?;
    `;

    // Ejecutar la consulta
    db.all(query, [movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error al cargar los datos de la película.");
        } else if (rows.length === 0) {
            res.status(404).send("Película no encontrada.");
        } else {
            // Organizar los datos en un objeto de película con elenco y crew
            const movieData = {
                id: rows[0].movie_id,
                title: rows[0].title,
                release_date: rows[0].release_date,
                overview: rows[0].overview,
                directors: [],
                writers: [],
                cast: [],
                crew: [],
            };

            // Crear un objeto para almacenar directores
            rows.forEach((row) => {
                if (
                    row.crew_member_id &&
                    row.crew_member_name &&
                    row.department_name &&
                    row.job
                ) {
                    // Verificar si ya existe una entrada con los mismos valores en directors
                    const isDuplicate = movieData.directors.some(
                        (crew_member) => crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de directors
                        if (row.department_name === "Directing" && row.job === "Director") {
                            movieData.directors.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // Crear un objeto para almacenar writers
            rows.forEach((row) => {
                if (
                    row.crew_member_id &&
                    row.crew_member_name &&
                    row.department_name &&
                    row.job
                ) {
                    // Verificar si ya existe una entrada con los mismos valores en writers
                    const isDuplicate = movieData.writers.some(
                        (crew_member) => crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de writers
                        if (row.department_name === "Writing" && row.job === "Writer") {
                            movieData.writers.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // Crear un objeto para almacenar el elenco
            rows.forEach((row) => {
                if (row.actor_id && row.actor_name && row.character_name) {
                    // Verificar si ya existe una entrada con los mismos valores en el elenco
                    const isDuplicate = movieData.cast.some(
                        (actor) => actor.actor_id === row.actor_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de elenco
                        movieData.cast.push({
                            actor_id: row.actor_id,
                            actor_name: row.actor_name,
                            character_name: row.character_name,
                            cast_order: row.cast_order,
                        });
                    }
                }
            });

            // Crear un objeto para almacenar el crew
            rows.forEach((row) => {
                if (
                    row.crew_member_id &&
                    row.crew_member_name &&
                    row.department_name &&
                    row.job
                ) {
                    // Verificar si ya existe una entrada con los mismos valores en el crew
                    const isDuplicate = movieData.crew.some(
                        (crew_member) => crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de crew
                        if (
                            row.department_name !== "Directing" &&
                            row.job !== "Director" &&
                            row.department_name !== "Writing" &&
                            row.job !== "Writer"
                        ) {
                            movieData.crew.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            res.render("pelicula", { movie: movieData, user: { id: userId } });
        }
    });
});

// Ruta para mostrar la página de un actor específico
app.get("/actor/:id", (req, res) => {
    const actorId = req.params.id;

    // Consulta SQL para obtener las películas en las que participó el actor
    const query = `
        SELECT DISTINCT
            person.person_name as actorName,
            movie.*
        FROM movie
                 INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
                 INNER JOIN person ON person.person_id = movie_cast.person_id
        WHERE movie_cast.person_id = ?;
    `;

    // Ejecutar la consulta
    db.all(query, [actorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error al cargar las películas del actor.");
        } else {
            // Obtener el nombre del actor
            const actorName = movies.length > 0 ? movies[0].actorName : "";

            res.render("actor", { actorName, movies });
        }
    });
});

// Ruta para mostrar la página de un director específico
app.get("/director/:id", (req, res) => {
    const directorId = req.params.id;

    // Consulta SQL para obtener las películas dirigidas por el director
    const query = `
        SELECT DISTINCT
            person.person_name as directorName,
            movie.*
        FROM movie
                 INNER JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
                 INNER JOIN person ON person.person_id = movie_crew.person_id
        WHERE movie_crew.job = 'Director' AND movie_crew.person_id = ?;
    `;

    // Ejecutar la consulta
    db.all(query, [directorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error al cargar las películas del director.");
        } else {
            // Obtener el nombre del director
            const directorName = movies.length > 0 ? movies[0].directorName : "";
            res.render("director", { directorName, movies });
        }
    });
});

app.get("/buscar-palabras-clave", (req, res) => {
    const keywords = req.query.keywords;
    console.log("Keywords recibidos:", keywords); // Depuración

    if (!keywords) {
        return res.status(400).send("Por favor, introduce palabras clave para realizar la búsqueda.");
    }

    const query = `
        SELECT DISTINCT movie.movie_id, movie.title
        FROM movie
                 LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
                 LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
                 LEFT JOIN movie_keywords ON movie.movie_id = movie_keywords.movie_id
                 LEFT JOIN keyword ON movie_keywords.keyword_id = keyword.keyword_id
        WHERE movie.title LIKE '%acción%'
           OR keyword.keyword_name LIKE '%acción%'
           OR movie_cast.character_name LIKE '%acción%'
           OR movie_cast.person_id IN (SELECT person_id FROM person WHERE person_name LIKE '%acción%')
           OR movie_crew.person_id IN (SELECT person_id FROM person WHERE person_name LIKE '%acción%');

    `;

    const keywordPattern = `%${keywords}%`;
    db.all(query, [keywordPattern, keywordPattern, keywordPattern, keywordPattern, keywordPattern], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error en la búsqueda de palabras clave.");
        } else {
            res.render("resultados_keyword", { results: rows });
        }
    });
});

// Ruta para buscar por palabras clave
app.get("/keyword", (req, res) => {
    res.render("search_keyword");
});

// Funcion para autocompletar la búsqueda
app.get("/autocomplete", (req, res) => {
    const searchTerm = req.query.term;

    if (searchTerm) {
        const query = `SELECT title FROM movie WHERE title LIKE ? LIMIT 10`;
        db.all(query, [`%${searchTerm}%`], (err, rows) => {
            if (err) {
                res.status(500).send("Error fetching autocomplete data.");
            } else {
                res.json(rows);
            }
        });
    } else {
        res.json([]);
    }
});

// Ruta para visualizar los resultados de la búsqueda por palabras clave


/*
// Ruta para el perfil del usuario - Cambiada a '/perfil'
app.get('/perfil', async (req, res) => {
    const userId = req.cookies.user_id;

    if (!userId) {
        return res.redirect('/login');
    }

    try {
        const db = await dbPromise;

        // Obtener datos del usuario
        const user = await db.get(`
            SELECT * FROM users
            WHERE user_id = ?
        `, userId);

        if (!user) {
            res.clearCookie('user_id');
            return res.redirect('/login');
        }

        // Obtener lista de reproducción del usuario
        const watchlist = await db.all(`
            SELECT m.*
            FROM movies m
                     JOIN user_watchlist w ON m.movie_id = w.movie_id
            WHERE w.user_id = ?
        `, userId);

        // Obtener calificaciones del usuario
        const ratings = await db.all(`
            SELECT m.title, r.rating, r.date
            FROM movies m
                     JOIN user_ratings r ON m.movie_id = r.movie_id
            WHERE r.user_id = ?
            ORDER BY r.date DESC
        `, userId);

        // Obtener reseñas del usuario
        const reviews = await db.all(`
            SELECT m.title, r.review, r.date
            FROM movies m
                     JOIN user_reviews r ON m.movie_id = r.movie_id
            WHERE r.user_id = ?
            ORDER BY r.date DESC
        `, userId);

        // Renderizar la vista con todos los datos
        res.render('perfil', {
            user,
            watchlist,
            ratings,
            reviews,
            error: null
        });

    } catch (error) {
        console.error('Error al cargar el perfil:', error);
        res.status(500).render('error', {
            message: 'Error al cargar el perfil'
        });
    }
});

// También actualiza las rutas de la API para mantener consistencia
app.post('/api/watchlist/agregar', async (req, res) => {
    const userId = req.cookies.user_id;
    if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        const db = await dbPromise;
        const { movieId } = req.body;

        await db.run(`
            INSERT OR IGNORE INTO user_watchlist (user_id, movie_id)
            VALUES (?, ?)
        `, [userId, movieId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error al agregar a watchlist:', error);
        res.status(500).json({ error: 'Error al agregar la película' });
    }
});

app.delete('/api/watchlist/eliminar', async (req, res) => {
    const userId = req.cookies.user_id;
    if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        const db = await dbPromise;
        const { movieId } = req.body;

        await db.run(`
            DELETE FROM user_watchlist
            WHERE user_id = ? AND movie_id = ?
        `, [userId, movieId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar de watchlist:', error);
        res.status(500).json({ error: 'Error al eliminar la película' });
    }
});
/!*app.get('/profile/opinions', (req, res) => {
    const userId = req.cookies?.user_id; // Asegúrate de que estás manejando la cookie de usuario

    if (!userId) {
        return res.redirect('/login'); // Redirige al login si no hay usuario autenticado
    }

    const query = `
        SELECT m.title, mu.rating, mu.opinion
        FROM movie_user mu
        JOIN movie m ON mu.movie_id = m.movie_id
        WHERE mu.user_id = ?;
    `;

    db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al cargar las opiniones.');
        }
        res.render('profile', { movieUserList: rows }); // Renderiza la vista del perfil con los gustos
    });
});
app.post('/add-opinion', (req, res) => {
    const { userId, movieId, rating, opinion } = req.body;

    const query = `INSERT INTO movie_user (user_id, movie_id, rating, opinion) VALUES (?, ?, ?, ?)`;
    db.run(query, [userId, movieId, rating, opinion], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al agregar la opinión.');
        }
        res.redirect('/profile/opinions');
    });
});
app.post('/edit-opinion', (req, res) => {
    const { id, rating, opinion } = req.body;

    const query = `UPDATE movie_user SET rating = ?, opinion = ? WHERE id = ?`;
    db.run(query, [rating, opinion, id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al modificar la opinión.');
        }
        res.redirect('/profile/opinions');
    });
});
app.post('/delete-opinion', (req, res) => {
    const { id } = req.body;

    const query = `DELETE FROM movie_user WHERE id = ?`;
    db.run(query, [id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al eliminar la opinión.');
        }
        res.redirect('/profile/opinions');
    });
});*!/
*/

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
