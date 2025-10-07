import cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DeleteFromS3, GetFromS3 } from "./s3Handling.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");

export default async function UpdateMediaFiles(oldContentUrl, newContentUrl) {
    try {
        let oldHtml = "";
        let newHtml = "";
        if (oldContentUrl) {
            if (process.env.NODE_ENV === "production") {
                const oldKey = new URL(oldContentUrl).pathname.slice(1);
                oldHtml = await GetFromS3(oldKey);
                await DeleteFromS3(oldKey);
            } else {
                const oldPath = path.join(rootDir, oldContentUrl);
                if (fs.existsSync(oldPath)) {
                    oldHtml = fs.readFileSync(oldPath, "utf-8");
                    fs.unlinkSync(oldPath);
                }
            }
        }
        if (newContentUrl) {
            if (process.env.NODE_ENV === "production") {
                const newKey = new URL(newContentUrl).pathname.slice(1);
                newHtml = await GetFromS3(newKey);
            } else {
                const newPath = path.join(rootDir, newContentUrl);
                if (fs.existsSync(newPath)) {
                    newHtml = fs.readFileSync(newPath, "utf-8");
                }
            }
        }
        if (!oldHtml || !newHtml) return;
        //Extract sources from old and new HTML
        const old$ = cheerio.load(oldHtml);
        const new$ = cheerio.load(newHtml);
        const oldSources = new Set(
            old$("img[src], video source[src]")
                .map((_, el) => old$(el).attr("src"))
                .get()
        );
        const newSources = new Set(
            new$("img[src], video source[src]")
                .map((_, el) => new$(el).attr("src"))
                .get()
        );
        for (const src of oldSources) {
            if (!src || newSources.has(src)) continue;
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
        console.error("Error in UpdateMediaFiles:", error);
    }
}