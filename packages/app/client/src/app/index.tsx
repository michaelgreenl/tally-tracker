import { Redirect } from 'expo-router';

import { useSession } from '../contexts/session-context';

export default function Index() {
    const session = useSession();
    return <Redirect href={session.isAuthenticated ? '/home' : '/login'} />;
}
