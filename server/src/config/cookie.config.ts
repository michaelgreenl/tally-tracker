import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

const cookieConfig: Object = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
};

export default cookieConfig;
