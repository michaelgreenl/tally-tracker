import { io } from 'socket.io-client';
import { registerCounterListeners } from './counter.socket';
import { useAuthStore } from '@/stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    withCredentials: true,
});

socket = registerCounterListeners(socket);

socket.on('connect', () => {
    console.log('Client connected: ', socket.id);

    // const authStore = useAuthStore();
    // if (authStore.user) {
    //     socket.emit('join-room', authStore.user.id);
    // }

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

export default socket;
