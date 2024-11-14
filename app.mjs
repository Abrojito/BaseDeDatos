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
app.set("view engine", "ejs");
import { fileURLToPath } from 'url';
import path from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.set("views", path.join(__dirname, "views"));

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

// Ruta de búsqueda por palabras clave
app.get('/buscar-palabras-clave', (req, res) => {
    const keywords = req.query.keywords;
    if (!keywords) {
        return res.status(400).send("No se proporcionaron palabras clave.");
    }

    // Aquí deberías realizar la lógica de búsqueda en tu base de datos
    // y devolver los resultados o manejar el caso de que no haya resultados

    // Supongamos que tienes una función `buscarPorPalabrasClave`:
    buscarPorPalabrasClave(keywords)
        .then(resultados => {
            if (resultados.length > 0) {
                res.render('resultados', { resultados }); // Asegúrate de tener una vista 'resultados'
            } else {
                res.send("No se encontraron resultados para las palabras clave proporcionadas.");
            }
        })
        .catch(error => {
            console.error("Error en la búsqueda:", error);
            res.status(500).send("Hubo un problema con la búsqueda.");
        });
});


app.get("/keyword", (req, res) => {
    res.render("search_keyword");
});

// Si `getSuggestions` es para autocompletar, podrías definirla como una función que maneje el autocompletado.
async function getSuggestions(searchTerm, db) {
    const query = `
        SELECT keyword_name
        FROM keyword
        WHERE keyword_name LIKE ?
        LIMIT 10;
    `;
    const keywordPattern = `%${searchTerm}%`;

    return new Promise((resolve, reject) => {
        db.all(query, [keywordPattern], (err, rows) => {
            if (err) {
                reject("Error en la búsqueda de palabras clave.");
            } else {
                resolve(rows);
            }
        });
    });
}

// Ejemplo de cómo usarla en una ruta
app.get("/api/autocomplete", async (req, res) => {
    const searchTerm = req.query.q;

    if (!searchTerm) {
        return res.status(400).send("Debe especificar un término de búsqueda.");
    }

    try {
        const suggestions = await getSuggestions(searchTerm, db);
        res.json(suggestions);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

// Ruta para visualizar los resultados de la búsqueda por palabras clave
app.get("/keyword/:q", (req, res) => {
    res.status(200).render("resultados_keyword.ejs");
});

// Funcion para buscar por palabras clave
app.get("/api/keyword", (req, res) => {
    const { q } = req.query;
    if (q == undefined) {
        res.status(400).send("Bad Request");
        return;
    }
    const query = `SELECT * FROM movie AS m WHERE m.movie_id
    IN (SELECT m.movie_id FROM movie AS m
    INNER JOIN movie_keywords AS mk ON m.movie_id
    = mk.movie_id INNER JOIN keyword AS k
    ON mk.keyword_id = k.keyword_id WHERE k.keyword_name
    LIKE ?);`;
    db.all(query, [`%${q}%`], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
            return;
        }
        res.status(200).send(rows);
    });
});

app.get("/api/search", async (req, res) => {
    const { q } = req.query;
    console.log("Searching for: ", q);
    if (!q) {
        res.status(400).send("Bad Request");
        return;
    }
    const results = await Promise.all([searchMovies(q), searchPeople(q)]);
    return res.send([...results[0], ...results[1]]);
});

// Ruta para ver la lista de favoritos del usuario
app.get("/favoritos", (req, res) => {
    const userId = req.cookies.user_id;

    if (!userId) {
        return res.redirect("/login");
    }

    const query = `
        SELECT m.movie_id, m.title
        FROM movie AS m
        INNER JOIN user_favorites AS uf ON m.movie_id = uf.movie_id
        WHERE uf.user_id = ?;
    `;

    db.all(query, [userId], (err, movies) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error al cargar los favoritos.");
        }
        res.render("favoritos", { movies });
    });
});

// Ruta para agregar una película a favoritos
app.post("/favoritos/agregar", (req, res) => {
    const userId = req.cookies.user_id;
    const { movieId } = req.body;

    if (!userId || !movieId) {
        return res.status(400).send("Usuario o película no especificados.");
    }

    const query = `
        INSERT OR IGNORE INTO user_favorites (user_id, movie_id)
        VALUES (?, ?);
    `;

    db.run(query, [userId, movieId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error al agregar a favoritos.");
        }
        res.json({ success: true });
    });
});

// Ruta para eliminar una película de favoritos
app.post("/favoritos/eliminar", (req, res) => {
    const userId = req.cookies.user_id;
    const { movieId } = req.body;

    if (!userId || !movieId) {
        return res.status(400).send("Usuario o película no especificados.");
    }

    const query = `
        DELETE FROM user_favorites
        WHERE user_id = ? AND movie_id = ?;
    `;

    db.run(query, [userId, movieId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error al eliminar de favoritos.");
        }
        res.json({ success: true });
    });
});

// Iniciar el servidor
app.listen(3009, () => {
    console.log('Servidor escuchando en el puerto 3009');
});
