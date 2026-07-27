import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectVersionsCommand,
  S3Client,
  type BucketLocationConstraint,
} from "@aws-sdk/client-s3";

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required variable: ${name}`);
  }
  return value;
}

function createClient() {
  return new S3Client({
    endpoint: required("S3_ENDPOINT"),
    region: required("S3_REGION"),
    forcePathStyle: required("S3_FORCE_PATH_STYLE") === "true",
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    },
  });
}

async function ensureBucket(client: S3Client, bucket: string) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status !== 404) throw error;
  }

  const region = required("S3_REGION");
  await client.send(
    new CreateBucketCommand({
      Bucket: bucket,
      ...(region === "us-east-1"
        ? {}
        : {
            CreateBucketConfiguration: {
              LocationConstraint: region as BucketLocationConstraint,
            },
          }),
    }),
  );
}

async function writeInventory(client: S3Client, bucket: string) {
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;
  do {
    const page = await client.send(
      new ListObjectVersionsCommand({
        Bucket: bucket,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      }),
    );
    for (const version of page.Versions ?? []) {
      process.stdout.write(
        `${JSON.stringify({
          type: "version",
          key: version.Key,
          versionId: version.VersionId,
          isLatest: version.IsLatest,
          lastModified: version.LastModified?.toISOString(),
          size: version.Size,
          eTag: version.ETag,
        })}\n`,
      );
    }
    for (const marker of page.DeleteMarkers ?? []) {
      process.stdout.write(
        `${JSON.stringify({
          type: "delete-marker",
          key: marker.Key,
          versionId: marker.VersionId,
          isLatest: marker.IsLatest,
          lastModified: marker.LastModified?.toISOString(),
        })}\n`,
      );
    }
    keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
    versionIdMarker = page.IsTruncated
      ? page.NextVersionIdMarker
      : undefined;
  } while (keyMarker !== undefined);
}

async function writeObject(
  client: S3Client,
  bucket: string,
  key: string,
  versionId?: string,
) {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(versionId ? { VersionId: versionId } : {}),
    }),
  );
  if (!response.Body) {
    throw new Error("The requested object returned an empty body");
  }
  process.stdout.write(Buffer.from(await response.Body.transformToByteArray()));
}

async function main() {
  const [command, bucket, key, versionId] = process.argv.slice(2);
  if (!command || !bucket) {
    throw new Error(
      "Usage: s3-operator.ts <ensure-bucket|inventory|get-object> <bucket> [key] [version-id]",
    );
  }

  const client = createClient();
  try {
    if (command === "ensure-bucket") {
      await ensureBucket(client, bucket);
      return;
    }
    if (command === "inventory") {
      await writeInventory(client, bucket);
      return;
    }
    if (command === "get-object" && key) {
      await writeObject(client, bucket, key, versionId);
      return;
    }
    throw new Error(`Unsupported S3 operator command: ${command}`);
  } finally {
    client.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "S3 operation failed");
  process.exitCode = 1;
});
