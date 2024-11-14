import pkg from "sqlite3";
const { Database } = pkg;

// Crear conexión a la base de datos
const db = new Database("./movies.db");

// Función para obtener todos los usuarios
export function getAllUsers() {
    return new Promise((resolve, reject) => {
        const query = "SELECT * FROM user";
        db.all(query, [], (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
        });
    });
}

// Función para obtener un usuario por su ID
export const getUserById = async (userId) => {
    try {
        const query = `
            SELECT
                user_id,
                user_username,
                user_email,
                user_role
            FROM user
            WHERE user_id = ?
        `;
        const user = await new Promise((resolve, reject) => {
            db.get(query, [userId], (err, user) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(user);
            });
        });
        return user;
    } catch (error) {
        console.error("Error al obtener el usuario:", error);
        throw error;
    }
};

// Función para crear un nuevo usuario
export const createUser = async (userData) => {
    try {
        const { username, email, password, role = "user" } = userData;

        // Verificar si el correo electrónico ya existe
        const queryCheck = `SELECT COUNT(*) as count FROM user WHERE user_email = ?`;
        const existingEmail = await new Promise((resolve, reject) => {
            db.get(queryCheck, [email], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row.count);
            });
        });

        if (existingEmail > 0) {
            throw new Error("Este correo electrónico ya está en uso");
        }

        const query = `
            INSERT INTO user (
                user_username,
                user_email,
                user_password,
                user_role
            ) VALUES (?, ?, ?, ?)
        `;
        const userId = await new Promise((resolve, reject) => {
            db.run(query, [username, email, password, role], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.lastID);
            });
        });
        return userId;
    } catch (error) {
        console.error("Error al crear el usuario:", error);
        throw error;
    }
};

// Función para actualizar un usuario
export const updateUser = async (userId, userData) => {
    try {
        const { username, email, role } = userData;
        const query = `
            UPDATE user
            SET
                user_username = COALESCE(?, user_username),
                user_email = COALESCE(?, user_email),
                user_role = COALESCE(?, user_role)
            WHERE user_id = ?
        `;
        const changes = await new Promise((resolve, reject) => {
            db.run(query, [username, email, role, userId], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes);
            });
        });
        return changes > 0;
    } catch (error) {
        console.error("Error al actualizar el usuario:", error);
        throw error;
    }
};

// Función para eliminar un usuario
export const deleteUser = async (userId) => {
    try {
        const query = "DELETE FROM user WHERE user_id = ?";
        const changes = await new Promise((resolve, reject) => {
            db.run(query, [userId], function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes);
            });
        });
        return changes > 0;
    } catch (error) {
        console.error("Error al eliminar el usuario:", error);
        throw error;
    }
};
