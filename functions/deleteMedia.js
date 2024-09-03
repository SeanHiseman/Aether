import { dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); 
const rootDir = path.resolve(__dirname, '..');

//Deletes media files by accessing route from content
function deleteMedia(content) {
    const mediaFiles = [];
    const mediaRegex = /\/media\/content\/([\w.-]+)/g;
    let match;
    while ((match = mediaRegex.exec(content)) !== null) {
        mediaFiles.push(match[1]);
    }

    mediaFiles.forEach(file => {
        const filePath = path.join(rootDir, 'media', 'content', file);
        fs.unlink(filePath, (error) => {
            if (error) console.error(`Failed to delete file: ${filePath}`, error);
        });
    });
};

export default deleteMedia;