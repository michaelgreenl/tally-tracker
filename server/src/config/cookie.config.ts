const cookieConfig: Object = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,

    // only necessary since using custom domain with gh-pages
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
};

export default cookieConfig;
