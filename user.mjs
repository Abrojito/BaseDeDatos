import express from "express";
import pkg from "sqlite3";
import { getMovieUserList } from "./profile.mjs";
const { Database } = pkg;
const db = new Database("./movies.db");

// Inicializa la aplicación Express
const user = express();

// Configuración para servir archivos estáticos y establecer el motor de plantillas
user.use(express.static("public"));
user.set("view engine", "ejs");

// Middleware para parsear el cuerpo de las solicitudes
user.use(express.urlencoded({ extended: true })); // Para formularios
user.use(express.json()); // Para JSON

user.get("/add", (_, res) => {
    res.render("add-user");
});

user.get("/edit/:id", (req, res) => {
    const { id } = req.params
    db.get("SELECT * FROM user WHERE user_id = ?", [id], (err, rows) => {
        if (err) throw err;
        res.render("edit-user", { user: rows })
    })
});

// Mostrar formulario de login
user.get("/login", (_, res) => {
    res.render("login");
});

// Obtener lista de películas que le gustan al usuario
user.get("/profile", async (req, res) => {
    const userId = req.session.user_id;

    try {
        const movieUserList = await getMovieUserList(userId);
        const userQuery = "SELECT * FROM user WHERE user_id = ?";

        db.get(userQuery, [userId], (err, user) => {
            if (err) {
                return res.status(500).send(err.message);
            }

            res.render("profile", { user, movieUserList });
        });
    } catch (error) {
        return res.status(500).send(error.message);
    }
});

// Registrar nuevo usuario (con email y contraseña)
user.post("/register", (req, res) => {
    const { username, name, email, password } = req.body;

    // Verificar si el usuario ya existe
    const checkQuery = "SELECT * FROM user WHERE user_username = ?";
    db.get(checkQuery, [username], (error, row) => {
        if (error) {
            return res.status(500).send(error.message);
        }

        if (row) {
            // Si el usuario ya existe, renderizamos la vista de "usuario ya registrado"
            return res.render("alreadyregistered", {
                message: `User ${username} is already registered`,
            });
        }

        // Insertar nuevo usuario en la base de datos
        const insertQuery =
            "INSERT INTO user (user_username, user_name, user_email, user_password) VALUES (?, ?, ?, ?)";
        db.run(insertQuery, [username, name, email, password], (error) => {
            if (error) {
                return res.status(500).send(error.message);
            }
            res.status(200).render("success", {
                message: `User ${username} has been created successfully!`,
            });
        });
    });
});

// Ruta para eliminar usuario (solo admin)
user.delete("/:id", (req, res) => {
    console.log("HOLA")
    const userId = req.cookies?.user_id;
    if (!userId) {
        return res.redirect("/login");
    }
    console.log("HOLA2")

    // Consulta para obtener el email del usuario actual
    const query = "SELECT * FROM user WHERE user_id = ?";
    db.get(query, [userId], (err, userData) => {
        if (err) {
            console.error("Error al obtener el usuario:", err);
            return res.status(500).send("Error al obtener el usuario");
        }
        if (!userData) {
            // Si el usuario no existe, redirige al login
            return res.redirect("/login");
        }
        console.log("HOLA3")

        if (userData.user_email === "violeta@hotmail.com") {
            // Si es el admin, procede a eliminar el usuario
            const { id } = req.params;
            console.log(id)
            const deleteQuery = "DELETE FROM user WHERE user_id = ?";
            db.run(deleteQuery, [id], (error) => {
                if (error) {
                    return res.status(500).send(error.message);
                }
                res.status(200).send(`El usuario con id ${id} ha sido borrado`);
            });
        } else {
            // Si no es el admin, redirige al inicio
            res.redirect("/");
        }
    });
});

// Iniciar sesión
user.post("/login", (req, res) => {
    const { username, password } = req.body;

    // Consulta para verificar al usuario en la BD
    const query =
        "SELECT * FROM user WHERE user_username = ? AND user_password = ?";

    db.get(query, [username, password], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error al verificar el usuario.");
        }
        if (row) {
            // Si el usuario es válido, puedes establecer la cookie y redirigir
            res.cookie("user_id", row.user_id); // Si usas cookies
            res.redirect("/"); // Redirigir al home o a donde desees
        } else {
            res.status(401).send("Usuario o contraseña incorrectos.");
        }
    });
});

// Actualizar usuario
user.put("/:id", (req, res) => {
    const { id } = req.params;
    const { username, name, email } = req.body;
    const query =
        "UPDATE user SET user_username = ?, user_name = ?, user_email = ? WHERE user_id = ?";
    db.run(query, [username, name, email, id], (error) => {
        if (error) {
            return res.status(500).send(error.message);
        }
        res.status(200).send(`El usuario ${username} ha sido actualizado`);
    });
});

export { user };
