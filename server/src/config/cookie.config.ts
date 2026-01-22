const cookieConfig: Object = {
    httpOnly: true,
    secure: true,
    sameSite: 'none', // Required for render and gh-pages
    maxAge: 24 * 60 * 60 * 1000,
};

export default cookieConfig;
