export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return {
      body: { error: error.message },
      status: error.status,
    };
  }

  console.error(error);

  return {
    body: { error: "Internal server error" },
    status: 500,
  };
}
