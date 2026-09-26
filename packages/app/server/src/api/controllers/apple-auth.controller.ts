import { Prisma } from '@prisma/client';
import * as users from '../../db/repositories/user.repository.js';
import { AppleAuthError, exchangeAppleCode, verifyAppleNotification } from '../../services/apple-auth.service.js';
import { sendSession } from './user.controller.js';
import type { AppleIdentity } from '../../services/apple-auth.service.js';
import type { AuthResponse } from '@tally/core';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'socket.io';

export const verifyApple = async (req: Request, res: Response<AuthResponse>, next: NextFunction) => {
    if (!req.is('application/json')) {
        return res.status(422).json({ success: false, message: 'Invalid sign-in request.' });
    }
    try {
        const identity = await exchangeAppleCode(req.body.authorizationCode, req.body.nonce);
        res.locals.appleIdentity = identity;
        req.body.email = identity.email ?? `apple:${identity.subject}`;
        return next();
    } catch (error) {
        if (error instanceof AppleAuthError) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        throw error;
    }
};

export const appleLogin = async (req: Request, res: Response<AuthResponse>) => {
    const identity = res.locals.appleIdentity as AppleIdentity;
    try {
        const existing = await users.getUserByAppleSubject(identity.subject);
        let user;
        if (existing) {
            user = await users.saveAppleIdentity(existing, identity);
        } else {
            if (!identity.email || !identity.emailVerified) {
                return res.status(401).json({ success: false, message: 'A verified email is required.' });
            }
            // Email is not proof of ownership of a Tally account. Linking requires its existing session.
            if (await users.getUserByEmail(identity.email)) {
                return res.status(409).json({
                    success: false,
                    message: 'Sign in first. Connect Apple in Settings.',
                });
            }
            user = await users.createAppleUser({ ...identity, email: identity.email });
        }
        if (!user) return res.status(401).json({ success: false, message: 'Please sign in again.' });
        return sendSession(user, req.body.rememberMe, res);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const existing = await users.getUserByAppleSubject(identity.subject);
            const user = existing && (await users.saveAppleIdentity(existing, identity));
            if (user) return sendSession(user, req.body.rememberMe, res);
            return res.status(409).json({ success: false, message: 'Sign in first. Connect Apple in Settings.' });
        }
        throw error;
    }
};

export const connectApple = async (req: Request, res: Response<AuthResponse>) => {
    const identity = res.locals.appleIdentity as AppleIdentity;
    const current = await users.getUserByEmail(req.user!.email);
    if (!current || current.id !== req.user!.id || current.sessionVersion !== req.user!.sessionVersion) {
        return res.status(401).json({ success: false, message: 'Please sign in again.' });
    }
    if (current.appleSubject && current.appleSubject !== identity.subject) {
        return res.status(409).json({ success: false, message: 'Another Apple account is already connected.' });
    }
    try {
        const user = await users.saveAppleIdentity(current, identity);
        if (!user) return res.status(401).json({ success: false, message: 'Please sign in again.' });
        return res.json({ success: true });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'This Apple account is already in use.' });
        }
        throw error;
    }
};

export const appleNotification = async (req: Request, res: Response) => {
    let event;
    try {
        event = await verifyAppleNotification(req.body.payload);
    } catch (error) {
        if (error instanceof AppleAuthError) return res.sendStatus(error.status);
        throw error;
    }
    if (event.type === 'consent-revoked' || event.type === 'account-deleted') {
        const user = await users.revokeAppleIdentity(event.sub, event.event_time);
        const io = req.app.get('io') as Server | undefined;
        if (user && io) {
            const sockets = await io.in(user.id).fetchSockets();
            for (const socket of sockets) {
                if (socket.data.sessionVersion < user.sessionVersion) socket.disconnect(true);
            }
        }
    }
    res.sendStatus(200);
};
