import express from "express";
import pkg from "sqlite3";
import { user } from "./user.mjs";
import cookieParser from "cookie-parser";
import profile from "./profile.mjs";
import reviews from "./reviews.mjs";
import userRoutes from "./userRoutes.mjs"; // Asegúrate de importar las rutas
import { fileURLToPath } from "url";
import path from "path";
import { getAllUsers } from "./userService.mjs";
import session from "express-session"; // Importar express-session

const { Database } = pkg;
const app = express();
const port = process.env.PORT || 3009;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración del motor de plantillas y vistas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Servir archivos estáticos
app.use(express.static("views"));

// Middleware para parsear JSON
app.use(express.json());
app.use(cookieParser());

app.use("/user", user);

// Configurar express-session para manejar sesiones de usuario
app.use(
    session({
        secret: "tu-secreto", // Secreto para firmar las sesiones
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }, // Usa secure: true en producción con HTTPS
    })
);

// Conectar a la base de datos
const db = new Database("./movies.db");

// Ruta para la lista de usuarios (Admin Screen)
app.get("/user-list", (req, res) => {
    const userId = req.cookies?.user_id;
    if (!userId) {
        // Si no hay usuario autenticado, redirige al login
        return res.redirect("/login");
    }

    // Consulta para obtener el email del usuario actual
    const query = "SELECT * FROM user WHERE user_id = ?";
    db.get(query, [userId], (err, user) => {
        if (err) {
            console.error("Error al obtener el usuario:", err);
            return res.status(500).send("Error al obtener el usuario");
        }
        if (!user) {
            // Si el usuario no existe, redirige al login
            return res.redirect("/login");
        }

        if (user.user_email === "violeta@gmail.com") {
            // Si es el admin, obtenemos la lista de usuarios
            getAllUsers()
                .then((users) => {
                    res.render("admin", { users });
                })
                .catch((error) => {
                    console.error("Error al cargar la lista de usuarios:", error);
                    res.status(500).send("Error al cargar la lista de usuarios");
                });
        } else {
            // Si no es el admin, redirige al inicio
            res.redirect("/");
        }
    });
});

// Rutas
app.use("/user", userRoutes); // Ruta de usuarios
app.use("/perfil", profile);
app.use("/movies", reviews); // Usa las rutas de reseñas

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

// Ruta para la lista de usuarios
app.get("/user-list", async (req, res) => {
    try {
        const users = await getAllUsers(); // Llama a la función para obtener los usuarios
        const currentUserRole = req.session.user_role; // Obtén el rol del usuario actual desde la sesión

        // Ahora la verificación de rol se elimina, cualquier usuario puede ver la lista de usuarios
        res.render("user-list", { users, currentUserRole }); // Pasa los datos a la vista
    } catch (error) {
        console.error("Error al cargar la lista de usuarios:", error); // Muestra el error en los logs
        res.status(500).send("Error al cargar la lista de usuarios");
    }
});

// Ruta para mostrar el formulario de login
app.get("/login", (req, res) => {
    res.render("login");
});

// Ruta para procesar el formulario de login
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    const query = `SELECT * FROM user WHERE user_username = ? AND user_password = ?`;

    db.get(query, [username, password], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error al verificar el usuario.");
        }
        if (row) {
            // Guardar el rol en la sesión
            req.session.user_role = row.user_role; // Asumiendo que 'user_role' está en la base de datos

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

// Ruta para el logout
app.get("/logout", (req, res) => {
    res.clearCookie("user_id"); // Elimina la cookie de usuario
    req.session.destroy(); // Destruye la sesión
    res.redirect("/login"); // Redirige a la página de login
});

// Ruta para la búsqueda
app.get("/buscar", (req, res) => {
    const searchTerm = req.query.q;

    const query = `
        SELECT 'movie' AS type,            -- Identifica registros como películas
               movie_id AS id,             -- ID de la película
               title AS name               -- Título de la película
        FROM movie
        WHERE title LIKE ?                 -- Filtra por título
        UNION                              -- Combina resultados
        SELECT 'actor' AS type,            -- Identifica registros como actores
               person_id AS id,            -- ID del actor
               person_name AS name         -- Nombre del actor
        FROM person
        WHERE person_id IN (               -- Solo personas en el elenco
            SELECT person_id
            FROM movie_cast)
          AND person_name LIKE ?             -- Filtra por nombre
        UNION                              -- Combina resultados
        SELECT 'director' AS type,         -- Identifica registros como directores
               person_id AS id,            -- ID del director
               person_name AS name         -- Nombre del director
        FROM person
        WHERE person_id IN (               -- Solo personas con rol de director
            SELECT person_id
            FROM movie_crew
            WHERE job = 'Director')
          AND person_name LIKE ?             -- Filtra por nombre
        ;
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

app.get("/pelicula/:id", (req, res) => {
    const movieId = req.params.id;
    const userId = req.cookies.user_id;

    // Consulta SQL para obtener los datos de la película, elenco y crew
    const query = `
        SELECT
            movie.*,                        -- Todas las columnas de la tabla 'movie'
            actor.person_name AS actor_name, -- Nombre del actor
            actor.person_id AS actor_id,    -- ID del actor
            crew_member.person_name AS crew_member_name, -- Nombre del miembro del crew
            crew_member.person_id AS crew_member_id, -- ID del miembro del crew
            movie_cast.character_name,      -- Nombre del personaje interpretado
            movie_cast.cast_order,          -- Orden del actor en los créditos
            department.department_name,     -- Nombre del departamento
            movie_crew.job                  -- Trabajo específico del miembro del crew
        FROM movie
                 LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id -- Une con el elenco
                 LEFT JOIN person AS actor ON movie_cast.person_id = actor.person_id -- Obtiene detalles del actor
                 LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id -- Une con el crew de la película
                 LEFT JOIN department ON movie_crew.department_id = department.department_id -- Obtiene el departamento
                 LEFT JOIN person AS crew_member ON crew_member.person_id = movie_crew.person_id -- Detalles del miembro del crew
        WHERE movie.movie_id = ?;           -- Filtra por ID de la película
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
        SELECT DISTINCT --Evito repeticion en los resultados
            person.person_name AS actorName, -- Nombre del actor
            movie.*                          -- Todas las columnas de la tabla 'movie'
        FROM movie
                 INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id -- Relaciona películas con el elenco
                 INNER JOIN person ON person.person_id = movie_cast.person_id  -- Relaciona personas con el elenco
        WHERE movie_cast.person_id = ?;       -- Filtra por ID del actor
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
        SELECT DISTINCT --Evito repeticion
            person.person_name AS directorName, -- Nombre del director
            movie.*                             -- Todas las columnas de la tabla 'movie'
        FROM movie
                 INNER JOIN movie_crew ON movie.movie_id = movie_crew.movie_id -- Relaciona películas con el crew
                 INNER JOIN person ON person.person_id = movie_crew.person_id  -- Relaciona personas con el crew
        WHERE movie_crew.job = 'Director'       -- Filtra solo por el rol de 'Director'
          AND movie_crew.person_id = ?;         -- Filtra por ID del director
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

// Ruta para buscar por palabras clave
app.get("/keyword", (req, res) => {
    res.render("search_keyword");
});

// Funcion para autocompletar la búsqueda
app.get("/api/autocomplete", (req, res) => {
    const { q } = req.query;
    if (q == undefined) {
        res.status(400).send("Bad Request");
        return;
    }
    const query = `SELECT k.keyword_name FROM keyword AS k
    WHERE k.keyword_name LIKE ? ORDER BY k.keyword_name LIMIT 10;`;
    db.all(query, [`%${q}%`], (err, rows) => {
        if (err) {
            res.status(500).send("Internal Server Error");
            return;
        }
        res.status(200).send(rows);
    });
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
    const query = `
        SELECT * FROM movie AS m WHERE m.movie_id
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

// Puerto de escucha
app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
});
