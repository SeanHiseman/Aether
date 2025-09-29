import multer from 'multer';
import path from 'path';
import { v4 } from 'uuid';

function imageUpload(destinationPath, fieldName) {
    const storage = process.env.NODE_ENV === "production"
        ? multer.memoryStorage()
        : multer.diskStorage({
            destination: (req, file, cb) => {
                const absolutePath = path.join(process.cwd(), destinationPath);
                cb(null, absolutePath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = `${v4()}-${path.extname(file.originalname)}`;
                cb(null, uniqueSuffix);
            },
        });

    return multer({
        storage: storage,
        limits: { fileSize: 1024 * 1024 * 100 }, //100MB max for premium, smaller files for free users already filtered
        fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith("image/")) {
                cb(null, true);
            } else {
                cb(new Error("Invalid file type"), false);
            }
        },
    }).single(fieldName);
}

export default imageUpload;