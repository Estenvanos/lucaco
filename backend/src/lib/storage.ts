import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

const client = (endpoint: string) =>
  new S3Client({
    endpoint,
    region: env.S3_REGION,
    forcePathStyle: true, // MinIO
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  });

const s3 = client(env.S3_ENDPOINT);
// Presigning is offline; it only needs the host the browser can reach.
const publicS3 = client(env.S3_PUBLIC_ENDPOINT);

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  }
}

export function putObject(key: string, body: Buffer, contentType: string) {
  return s3.send(
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export function deleteObject(key: string) {
  return s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

export function signedGetUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(publicS3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn });
}
