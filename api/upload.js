import axios from 'axios';
import { Writable } from 'stream';

// Configuración para que Vercel no interprete el body automáticamente
export const config = {
    api: {
        bodyParser: false,
    },
};

// Función para leer los datos del formulario (multipart/form-data)
const formidable = (req) => {
    return new Promise((resolve, reject) => {
        let chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', err => reject(err));
    });
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        // Lee el buffer completo de la request
        const data = await formidable(req);
        
        // Extrae el boundary del content-type header
        const contentType = req.headers['content-type'];
        const boundary = contentType.split('; ')[1].split('=')[1];

        // Separa las partes del formulario
        const parts = data.toString('binary').split(`--${boundary}`);
        
        // Encuentra el nombre del archivo y el contenido del archivo
        const filePart = parts.find(part => part.includes('filename='));
        if (!filePart) {
            return res.status(400).send('No se encontró el archivo en la subida.');
        }
        
        const fileNameMatch = filePart.match(/filename="([^"]+)"/);
        const fileName = fileNameMatch ? fileNameMatch[1] : 'unknownfile.zip';

        const contentStartIndex = filePart.indexOf('\r\n\r\n') + 4;
        const fileContentBinary = filePart.substring(contentStartIndex, filePart.lastIndexOf('\r\n'));
        const fileContentBase64 = Buffer.from(fileContentBinary, 'binary').toString('base64');
        
        // Llama a la API de GitHub
        const GITHUB_USER = process.env.GITHUB_USER;
        const GITHUB_REPO = process.env.GITHUB_REPO;
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}`;

        // 1. Subir archivo
        await axios.put(
            `${GITHUB_API_URL}/contents/uploads/${fileName}`,
            { message: `Subiendo ${fileName} para compilar`, content: fileContentBase64 },
            { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );

        // 2. Activar workflow
        await axios.post(
            `${GITHUB_API_URL}/actions/workflows/compiler.yml/dispatches`,
            { ref: 'main' },
            { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
        );

        res.status(200).send(`¡Éxito! Tu mod está compilando. Revisa la pestaña "Actions" en tu repositorio '${GITHUB_REPO}'.`);

    } catch (error) {
        console.error("ERROR:", error.response ? error.response.data : error.message);
        res.status(500).send("Hubo un error al comunicarse con GitHub.");
    }
          }
