const axios = require('axios');
const formidable = require('formidable');
const fs = require('fs');

// Desactivamos el bodyParser de Vercel para que formidable pueda leer el stream
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        // Usamos formidable para procesar el formulario con el archivo
        const fileData = await new Promise((resolve, reject) => {
            const form = formidable({ maxFileSize: 100 * 1024 * 1024 }); // Límite de 100MB
            form.parse(req, (err, fields, files) => {
                if (err) return reject(err);
                if (!files.modFile) return reject(new Error("No se encontró el archivo 'modFile'"));
                resolve({ file: files.modFile });
            });
        });

        // Leemos el archivo que formidable guardó temporalmente
        const fileContent = fs.readFileSync(fileData.file.filepath);
        const fileContentBase64 = fileContent.toString('base64');
        const fileName = fileData.file.originalFilename;

        // Obtenemos las variables de entorno
        const GITHUB_USER = process.env.GITHUB_USER;
        const GITHUB_REPO = process.env.GITHUB_REPO;
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}`;

        // 1. Subimos el archivo a GitHub
        await axios.put(
            `${GITHUB_API_URL}/contents/uploads/${fileName}`,
            {
                message: `Subiendo ${fileName} para compilar`,
                content: fileContentBase64
            },
            { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );

        // 2. Activamos el workflow de GitHub Actions
        await axios.post(
            `${GITHUB_API_URL}/actions/workflows/compiler.yml/dispatches`,
            { ref: 'main' },
            { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
        );

        // Si todo sale bien, enviamos una respuesta de éxito
        res.status(200).send(`¡Éxito! Tu mod está compilando. Revisa la pestaña "Actions" en tu repositorio '${GITHUB_REPO}'.`);

    } catch (error) {
        console.error("ERROR DETALLADO:", error);
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).send(`Hubo un error: ${errorMessage}`);
    }
            }
