import { client } from "./client";

type GetPreSignedUrlParams = {
  fileSize: number;
  contentType: string;
  filename: string;
};

type GetPreSignedUrlResponse = {
  preSignedUrl: string;
  filename: string;
  fileSize: number;
  contentType: string;
  expiresIn: number;
  originalFilename: string;
  uploadedBy: string;
  uploadedAt: string;
};

export const getPreSignedUrl = async (
  params: GetPreSignedUrlParams
): Promise<GetPreSignedUrlResponse> => {
  const response = await client.post("/uploads/pre-signed-url", params, {
    withCredentials: true,
  });
  return response.data;
};
