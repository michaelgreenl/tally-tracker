export class ApiError extends Error {
    status?: number;
    success: boolean;
    data?: unknown;

    constructor(message: string, status?: number, data?: unknown) {
        super(message);
        this.status = status;
        this.data = data;
        this.success = false;

        // Required for instanceof checks to work after transpilation
        Object.setPrototypeOf(this, ApiError.prototype);
        this.name = 'ApiError';
    }
}

export const getErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};
