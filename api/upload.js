const axios = require('axios');
const formidable = require('formidable');
const fs = require('fs');

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
        const fileData = await new Promise((resolve, reject) => {
            const form = formidable({ maxFileSize: 100 * 1024 * 1024 });
            form.parse(req, (err, fields, files) => {
                if (err) return reject(err);
                if (!files.modFile) return reject(new Error("No se encontró el archivo 'modFile'"));
                resolve({ file: files.modFile });
            });
        });

        const fileContent = fs.readFileSync(fileData.file.filepath);
        const fileContentBase64 = fileContent.toString('base64');
        const fileName = fileData.file.originalFilename;

        const GITHUB_USER = process.env.GITHUB_USER;
        const GITHUB_REPO = process.env.GITHUB_REPO;
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}`;

        await axios.put(
            `${GITHUB_API_URL}/contents/uploads/${fileName}`,
            {
                message: `Subiendo ${fileName} para compilar`,
                content: fileContentBase64
            },
            { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );

        await axios.post(
            `${GITHUB_API_URL}/actions/workflows/compiler.yml/dispatches`,
            { ref: 'main' },
            { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
        );

        res.status(200).send(`¡Éxito! Tu mod está compilando. Revisa la pestaña "Actions" en tu repositorio '${GITHUB_REPO}'.`);

    } catch (error) {
        console.error("ERROR DETALLADO:", error);
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).send(`Hubo un error: ${errorMessage}`);
    }
}
