import { v4 as uuidv4 } from 'uuid';
export function randomUUID() {
    if (crypto?.randomUUID) {
        return crypto.randomUUID();
    }

    return uuidv4();
}
