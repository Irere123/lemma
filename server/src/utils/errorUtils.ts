import { ZodError } from "zod";

export function formatZodError(error: ZodError): string {
  return error.errors
    .map((err) =>
      err.path.length ? `${err.path.join(".")}:${err.message}` : err.message
    )
    .join(", ");
}

const getJsonBody = (body: any) => {
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString());
    } catch (error) {
      return `[Invalid JSON] Raw body: ${body.toString()}`;
    }
  }
  return body;
};

export const handleRequestError = ({
  error,
  req,
  res,
  action,
}: {
  error: any;
  req: any;
  res: any;
  action: string;
}) => {
  try {
    if (error instanceof ZodError) {
      res.status(400).json({
        message: formatZodError(error),
      });
    } else {
      res.status(500).json({
        message: error.message || "Unknown error",
        code: error.code || "unknown_error",
      });
    }
  } catch (error) {
    console.log("Failed to log error / warning");
    console.log(`Request: ${req.originalUrl}`);
    console.log(`Body: ${req.body}`);
    console.log(`Log error: ${error}`);
  }
};

export const handleFrontendReqError = ({
  action,
  error,
  req,
  res,
}: {
  error: any;
  req: any;
  res: any;
  action: string;
}) => {
  try {
    res
      .status(400)
      .json({
        message: error.message || "Unknown error",
        code: error.code || "unknown_error",
      });
  } catch (error) {
    console.log("Failed to log error / warning");
  }
};
