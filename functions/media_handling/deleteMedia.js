import { dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); 
const rootDir = path.resolve(__dirname, '../../');

//Deletes media files by accessing route from content
function deleteMedia(content) {
    const mediaFiles = [];
    const mediaRegex = /(media\/(?:[^\/\s]+\/)*[^\/\s]+\.[a-zA-Z0-9]+)/g; //Matches any valid file path
    let match;
    while ((match = mediaRegex.exec(content)) !== null) {
        mediaFiles.push(match[0]);
    }
    mediaFiles.forEach(file => {
        const absoluteFilePath = path.join(rootDir, file);
        fs.unlink(absoluteFilePath, (error) => {
            if (error) console.error(`Failed to delete file: ${absoluteFilePath}`, error);
        });
    });
};

export default deleteMedia;