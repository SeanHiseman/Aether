import path from 'path';
import { v4 } from 'uuid';

function GenerateFileName(file, prefix) {
	const ext = path.extname(file.originalname); 
	return `${prefix}-${v4()}${ext}`;
}

export { GenerateFileName };