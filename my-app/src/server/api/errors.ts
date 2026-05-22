export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return {
      body: {
        error: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
      status: error.status,
    };
  }

  console.error(error);

  return {
    body: { error: "Internal server error" },
    status: 500,
  };
}
