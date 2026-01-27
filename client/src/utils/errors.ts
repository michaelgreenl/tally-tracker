export class ApiError extends Error {
    status?: number;
    success: boolean;
    data?: any;

    constructor(message: string, status?: number, data?: any) {
        super(message);
        this.status = status;
        this.data = data;
        this.success = false;

        Object.setPrototypeOf(this, ApiError.prototype);
        this.name = 'ApiError';
    }
}
