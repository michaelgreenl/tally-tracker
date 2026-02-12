import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

// sameSite: 'none' + secure: true is required in production for cross-origin
// cookie delivery (frontend and API are on different domains).
const cookieConfig: Object = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
};

export default cookieConfig;
