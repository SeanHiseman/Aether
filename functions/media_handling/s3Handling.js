import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';

dotenv.config();

const s3 = new S3Client({
	region: process.env.AWS_REGION
});

export async function UploadToS3(key, body, contentType) {
	const command = new PutObjectCommand({
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: key,
		Body: body,
		ContentType: contentType,
	});
	await s3.send(command);
	return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export async function DeleteFromS3(key) {
	const command = new DeleteObjectCommand({
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: key
	});
	await s3.send(command);
}

export async function GetFromS3(key) {
	const command = new GetObjectCommand({
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: key
	});
	const { Body } = await s3.send(command);
	const streamToString = (stream) =>
		new Promise((resolve, reject) => {
			const chunks = [];
			stream.on("data", (chunk) => chunks.push(chunk));
			stream.on("error", reject);
			stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
		});
	return await streamToString(Body);
}