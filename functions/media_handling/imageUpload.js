import multer from 'multer';
import path from 'path';
import { v4 } from 'uuid';

function imageUpload(destinationPath, fieldName) {
    console.log("destinationPath:", destinationPath);
    console.log("fieldName:", fieldName);
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const absolutePath = path.join(process.cwd(), destinationPath);
            cb(null, absolutePath);
        },
        filename: (req, file, cb) => {
        //Use a unique filename to prevent file name conflicts
            const uniqueSuffix = `${v4()}-${path.extname(file.originalname)}`;
            cb(null, uniqueSuffix);
        },
    });
    return multer({
        storage: storage, 
        limits: { fileSize: 1024 * 1024 * 5 }, //Limit size to 5MB 
        fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true); //Accept file
            } else {
                cb(new Error('Invalid file type'), false); //Reject file
            }
        }
    }).single(fieldName);
}

export default imageUpload;