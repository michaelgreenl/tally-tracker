import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

// sameSite: 'none' + secure: true is required in production for cross-origin
// cookie delivery (frontend and API are on different domains).
const baseCookieConfig = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
};

// Browser without remember me — access token is the only token
export const accessCookieConfig = {
    ...baseCookieConfig,
    maxAge: 24 * 60 * 60 * 1000, // 1d
};

// Browser with remember me — short-lived, refresh handles continuity
export const shortAccessCookieConfig = {
    ...baseCookieConfig,
    maxAge: 15 * 60 * 1000, // 15m
};

export const refreshCookieConfig = {
    ...baseCookieConfig,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
};

// For clearing cookies — same options without maxAge
export const clearCookieConfig = baseCookieConfig;
