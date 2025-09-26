import cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { DeleteFromS3, GetFromS3 } from './s3Handling.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); 
const rootDir = path.resolve(__dirname, '../../');

export default async function DeleteMedia(contentUrl) {
    try {
        let htmlContent;
        if (process.env.NODE_ENV === "production") {
            const urlParts = new URL(contentUrl);
            const s3Key = urlParts.pathname.slice(1); //remove leading "/"
            htmlContent = await GetFromS3(s3Key);
            await DeleteFromS3(s3Key);
        } else {
            const absoluteHtmlPath = path.join(rootDir, contentUrl);
            if (fs.existsSync(absoluteHtmlPath)) {
                htmlContent = fs.readFileSync(absoluteHtmlPath, "utf-8");
                fs.unlinkSync(absoluteHtmlPath); 
            }
        }
        if (!htmlContent) return;
        //Parse HTML to find media references
        const $ = cheerio.load(htmlContent);
        const sources = [];
        $("img[src], video source[src]").each((_, el) => {
            sources.push($(el).attr("src"));
        });
        //Delete each media file
        for (const src of sources) {
            if (!src) continue;
            if (process.env.NODE_ENV === "production") {
                const urlParts = new URL(src);
                const s3Key = urlParts.pathname.slice(1);
                await DeleteFromS3(s3Key); 
            } else {
                const absoluteFilePath = path.join(rootDir, src);
                if (fs.existsSync(absoluteFilePath)) {
                    fs.unlinkSync(absoluteFilePath);
                }
            }
        }
    } catch (error) {
        console.error("Error in deleteMedia:", error);
    }
}