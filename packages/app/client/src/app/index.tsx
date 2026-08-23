import { Redirect } from 'expo-router';

import { useSession } from '../session';

export default function Index() {
    const session = useSession();
    return <Redirect href={session.isAuthenticated ? '/home' : '/login'} />;
}
