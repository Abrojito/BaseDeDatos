import express from "express";
import pkg from "sqlite3";
import {getMovieUserList, } from "./profile.mjs";

const { Database } = pkg;

const db = new Database("./movies.db");

const user = express();

// Middleware para parsear el cuerpo de las solicitudes
user.use(express.urlencoded({ extended: true })); // Para formularios
user.use(express.json()); // Para JSON

user.get("/add", (_, res) => {
    res.render("add-user");
});

user.get("/edit", (_, res) => {
    res.render("edit-user");
});

// Mostrar formulario de login
user.get("/login", (_, res) => {
    res.render("login");
});

// Obtener lista de películas que le gustan al usuario
user.get("/profile", async (req, res) => {
    const userId = req.session.user_id; // Asegúrate de que esto esté guardado en la sesión

    try {
        const movieUserList = await getMovieUserList(userId); // Aquí es donde se obtiene la lista
        const userQuery = "SELECT * FROM user WHERE user_id = ?";

        db.get(userQuery, [userId], (err, user) => {
            if (err) {
                return res.status(500).send(err.message);
            }

            // Renderizar la vista del perfil, pasando el usuario y la lista de películas
            res.render("profile", { user, movieUserList }); // Asegúrate de que movieUserList se pase aquí
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
            return res.status(400).send("User already registered");
        }

        // Insertar nuevo usuario en la base de datos
        const insertQuery = "INSERT INTO user (user_username, user_name, user_email, user_password) VALUES (?, ?, ?, ?)";
        db.run(insertQuery, [username, name, email, password], (error) => {
            if (error) {
                return res.status(500).send(error.message);
            }
            res.status(200).render('success', { message: `User ${username} has been created successfully!` });
        });
    });
});

// Iniciar sesión
user.post("/login", (req, res) => {
    const { username, password } = req.body;

    // Consulta para verificar al usuario en la BD
    const query = "SELECT * FROM user WHERE user_username = ? AND user_password = ?";

    db.get(query, [username, password], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error al verificar el usuario.");
        }
        if (row) {
            // Si el usuario es válido, puedes establecer la cookie y redirigir
            res.cookie('user_id', row.user_id); // Si usas cookies
            res.redirect('/'); // Redirigir al home o a donde desees
        } else {
            res.status(401).send("Usuario o contraseña incorrectos.");
        }
    });
});

// Actualizar usuario
user.put("/:id", (req, res) => {
    const { id } = req.params;
    const { username, name, email } = req.body;
    const query = "UPDATE user SET user_username = ?, user_name = ?, user_email = ? WHERE user_id = ?";
    db.run(query, [username, name, email, id], (error) => {
        if (error) {
            return res.status(500).send(error.message);
        }
        res.status(200).send(`El usuario ${username} ha sido actualizado`);
    });
});

// Borrar usuario
user.delete("/:id", (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM user WHERE user_id = ?";
    db.run(query, [id], (error) => {
        if (error) {
            return res.status(500).send(error.message);
        }
        res.status(200).send(`El usuario con id ${id} ha sido borrado`);
    });
});

export { user };
