import { AwsClient } from "aws4fetch";
import { env } from "cloudflare:workers";
import { err, ResultAsync } from "neverthrow";

interface fileOptions {
  contentType?: string;
  filename?: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

class StorageClient {
  private client: AwsClient;

  constructor() {
    this.client = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      region: "auto",
    });
  }

  async uploadFileSigned(key: string, opts?: fileOptions) {
    const type = opts?.contentType ?? "image/jpeg";

    const res = await ResultAsync.fromPromise(
      this.client.sign(`${env.R2_BUCKET_URL}/${key}`, {
        method: "PUT",
        headers: {
          "Content-Type": type,
          "x-amz-meta-original-filename": opts?.filename ?? "",
          "x-amz-meta-uploaded-by": opts?.uploadedBy ?? "",
          "x-amz-meta-uploaded-at": opts?.uploadedAt ?? "",
        },
        aws: {
          signQuery: true,
        },
      }),
      (e: unknown) => err(e)
    );

    if (res.isErr()) {
      console.error(res.error);
      throw new Error("Failed to upload file");
    }

    return res.value;
  }

  async delete(key: string) {
    const res = await ResultAsync.fromPromise(
      this.client.fetch(`${env.R2_BUCKET_URL}/${key}`, {
        method: "DELETE",
      }),
      (e: unknown) => err(e)
    );

    if (res.isErr()) {
      console.error(res.error);
      throw new Error("Failed to delete file");
    }

    return true;
  }
}

export const storage = new StorageClient();
