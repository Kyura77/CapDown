import type { FastifyReply } from "fastify";

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function sendAppError(reply: FastifyReply, error: unknown) {
  if (isAppError(error)) {
    const payload: Record<string, unknown> = {
      code: error.code,
      message: error.message,
    };

    if (error.details !== undefined) {
      payload.details = error.details;
    }

    return reply.status(error.statusCode).send(payload);
  }

  reply.log.error(error);
  return reply.status(500).send({
    code: "internal_error",
    message: "Unexpected API failure",
  });
}
