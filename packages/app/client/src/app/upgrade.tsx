import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../colors';
import { AuthLink, styles as formStyles } from '../components/auth-form';
import { BackButton } from '../components/back-button';
import { Snackbar } from '../components/snackbar';
import { TallyBrand } from '../components/tally-brand';
import { billingApiKey, BillingService, purchaseNotice } from '../services/billing.service';
import { useSession } from '../session';

// Guests and the web can preview plans; native checkout always uses the store's package and price.
const plans = [
    { id: 'monthly', name: 'Monthly', price: '$1', period: '/ month', detail: 'Billed monthly' },
    { id: 'yearly', name: 'Yearly', price: '$10', period: '/ year', detail: 'Billed yearly' },
    { id: 'lifetime', name: 'Lifetime', price: '$20', period: 'once', detail: 'One-time payment' },
] as const;

export default function UpgradeScreen() {
    const session = useSession();
    return <UpgradeContent key={session.user?.id ?? 'guest'} session={session} />;
}

function UpgradeContent({ session }: { session: ReturnType<typeof useSession> }) {
    const router = useRouter();
    const [selectedPlan, setSelectedPlan] = useState<(typeof plans)[number]>(plans[1]);
    const [store, setStore] = useState<Awaited<ReturnType<typeof BillingService.load>> | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [retry, setRetry] = useState(0);
    const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);
    const [needsRestore, setNeedsRestore] = useState(false);
    const [message, setMessage] = useState('');
    const busyRef = useRef(false);
    const userId = session.user?.id;
    const currentUserId = useRef(userId);
    useLayoutEffect(() => {
        currentUserId.current = userId;
        return () => {
            currentUserId.current = undefined;
        };
    }, [userId]);
    const available = Boolean(billingApiKey());
    const canLoad = available && Boolean(userId);
    const product = canLoad ? store?.packages[selectedPlan.id] : null;
    const purchaseDisabled = !product || Boolean(busy) || needsRestore;

    useEffect(() => {
        let active = true;
        if (canLoad && userId) {
            void BillingService.load(userId)
                .then((result) => {
                    if (active) setStore(result);
                })
                .catch(() => {
                    if (active) setLoadError(true);
                });
        }
        return () => {
            active = false;
        };
    }, [canLoad, userId, retry]);

    async function submit(action: 'purchase' | 'restore') {
        if (!userId || !available || busyRef.current || (action === 'purchase' && purchaseDisabled)) return;
        busyRef.current = true;
        setBusy(action);
        setMessage('');
        let completed = false;
        try {
            if (action === 'purchase' && product) await BillingService.purchase(userId, product);
            else await BillingService.restore(userId);
            completed = true;
            if (currentUserId.current !== userId) return;
            const verifiedUser = await session.refreshPurchases();
            if (currentUserId.current !== userId) return;
            const premium = verifiedUser.tier === 'PREMIUM';
            setNeedsRestore(action === 'purchase' && !premium);
            setMessage(
                premium
                    ? action === 'purchase'
                        ? 'Premium is now active. Thank you!'
                        : 'Your Premium access has been restored.'
                    : action === 'restore'
                      ? 'No active purchases were found for this store account.'
                      : 'Your purchase is complete. Access is still being verified. Try Restore purchases shortly.',
            );
        } catch (error) {
            if (currentUserId.current !== userId) return;
            if (completed) {
                setNeedsRestore(true);
                setMessage(
                    'Your purchase could not be verified. Use Restore purchases to try again; do not purchase again.',
                );
            } else {
                setMessage(
                    purchaseNotice(
                        error,
                        action === 'restore' ? 'Purchases could not be restored. Please try again.' : undefined,
                    ) ?? '',
                );
            }
        } finally {
            busyRef.current = false;
            setBusy(null);
        }
    }

    return (
        <>
            <Head>
                <title>Tally | Upgrade</title>
            </Head>
            <SafeAreaView style={styles.safeArea} testID='upgrade-page'>
                <View style={styles.navigation}>
                    <BackButton
                        onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
                        testID='upgrade-back'
                    />
                </View>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.content}>
                        <View style={styles.intro}>
                            <TallyBrand style={styles.title}>Tally Premium</TallyBrand>
                            <Text style={styles.subtitle}>A little more, together.</Text>
                        </View>

                        <View style={styles.benefits}>
                            {['Share your counters with others', 'Join unlimited shared counters'].map((benefit) => (
                                <View key={benefit} style={styles.benefit}>
                                    <Svg aria-hidden width={20} height={20} viewBox='0 0 24 24'>
                                        <Path
                                            d='m5 12 4 4L19 6'
                                            fill='none'
                                            stroke={colors.link}
                                            strokeWidth={2}
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                        />
                                    </Svg>
                                    <Text style={styles.benefitText}>{benefit}</Text>
                                </View>
                            ))}
                        </View>

                        {!session.isAuthenticated && (
                            <View style={styles.freeAccount} testID='upgrade-free-account'>
                                <Text style={styles.sectionTitle}>Just need more counters?</Text>
                                <Text style={styles.copy}>
                                    A free account includes unlimited personal counters and sync across devices.
                                </Text>
                                <AuthLink href='/register' style={styles.textAction} testID='upgrade-register'>
                                    Create a free account
                                </AuthLink>
                                <View style={styles.signIn}>
                                    <Text style={styles.copy}>Already have an account?</Text>
                                    <AuthLink href='/login' style={styles.textAction} testID='upgrade-login'>
                                        Sign in
                                    </AuthLink>
                                </View>
                            </View>
                        )}

                        {session.isPremium ? (
                            <View style={styles.activeAccess} testID='upgrade-active'>
                                <Text style={styles.sectionTitle}>Premium is active</Text>
                                <Text style={styles.copy}>
                                    Your account already has access to all Premium features.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.planSection} testID='upgrade-plans'>
                                <View style={styles.planHeading}>
                                    <Text accessibilityRole='header' aria-level={2} style={styles.sectionTitle}>
                                        Choose your plan
                                    </Text>
                                    {!canLoad && <Text style={styles.copy}>Planned pricing · USD</Text>}
                                    {canLoad && !store && !loadError && (
                                        <Text accessibilityLiveRegion='polite' style={styles.copy}>
                                            Loading store prices…
                                        </Text>
                                    )}
                                    {loadError && (
                                        <View>
                                            <Text accessibilityRole='alert' style={styles.copy}>
                                                Store prices could not be loaded.
                                            </Text>
                                            <Pressable
                                                accessibilityRole='button'
                                                onPress={() => {
                                                    setLoadError(false);
                                                    setRetry((value) => value + 1);
                                                }}
                                                style={styles.textAction}
                                                testID='upgrade-retry'
                                            >
                                                <Text style={styles.restoreText}>Try again</Text>
                                            </Pressable>
                                        </View>
                                    )}
                                </View>
                                {plans.map((plan) => {
                                    const selected = plan.id === selectedPlan.id;
                                    const price = canLoad
                                        ? (store?.packages[plan.id]?.product.priceString ?? '—')
                                        : plan.price;
                                    const disabled = Boolean(busy) || (canLoad && !store?.packages[plan.id]);
                                    return (
                                        <Pressable
                                            key={plan.id}
                                            accessibilityRole='button'
                                            accessibilityLabel={`${plan.name}, ${price} ${plan.period}, ${plan.detail}`}
                                            accessibilityState={{ selected, disabled }}
                                            disabled={disabled}
                                            aria-pressed={selected}
                                            onPress={() => setSelectedPlan(plan)}
                                            style={({ pressed }) => [
                                                styles.plan,
                                                selected && styles.planSelected,
                                                pressed && styles.pressed,
                                            ]}
                                            testID={`upgrade-plan-${plan.id}`}
                                        >
                                            <View aria-hidden style={[styles.radio, selected && styles.radioSelected]}>
                                                {selected && <View style={styles.radioDot} />}
                                            </View>
                                            <View style={styles.planCopy}>
                                                <Text style={styles.planName}>{plan.name}</Text>
                                                <Text style={styles.copy}>
                                                    {canLoad && store && !store.packages[plan.id]
                                                        ? 'Unavailable'
                                                        : plan.detail}
                                                </Text>
                                            </View>
                                            <View style={styles.priceBlock}>
                                                <Text style={styles.price}>{price}</Text>
                                                <Text style={styles.copy}>{plan.period}</Text>
                                            </View>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}

                        <View style={styles.actions}>
                            {!session.isPremium && (
                                <Pressable
                                    accessibilityRole='button'
                                    accessibilityState={{ disabled: purchaseDisabled, busy: busy === 'purchase' }}
                                    disabled={purchaseDisabled}
                                    onPress={() => void submit('purchase')}
                                    style={({ pressed }) => [
                                        styles.purchaseButton,
                                        purchaseDisabled && styles.disabled,
                                        pressed && styles.pressed,
                                    ]}
                                    testID='upgrade-purchase'
                                >
                                    <Text style={formStyles.primaryButtonText}>
                                        {busy === 'purchase'
                                            ? 'Completing purchase…'
                                            : `Continue with ${selectedPlan.name}`}
                                    </Text>
                                </Pressable>
                            )}
                            {session.isPremium && store?.managementURL?.startsWith('https://') && (
                                <Pressable
                                    accessibilityRole='button'
                                    disabled={Boolean(busy)}
                                    onPress={() =>
                                        void Linking.openURL(store.managementURL!).catch(() =>
                                            setMessage('Subscription settings could not be opened. Please try again.'),
                                        )
                                    }
                                    style={styles.restoreButton}
                                    testID='upgrade-manage'
                                >
                                    <Text style={styles.restoreText}>Manage subscription</Text>
                                </Pressable>
                            )}
                            <Pressable
                                accessibilityRole='button'
                                accessibilityState={{ disabled: !canLoad || Boolean(busy), busy: busy === 'restore' }}
                                disabled={!canLoad || Boolean(busy)}
                                onPress={() => void submit('restore')}
                                style={styles.restoreButton}
                                testID='upgrade-restore'
                            >
                                <Text style={[styles.restoreText, !canLoad && styles.disabled]}>
                                    {busy === 'restore' ? 'Restoring purchases…' : 'Restore purchases'}
                                </Text>
                            </Pressable>
                            <Text style={[styles.copy, styles.disclosure]}>
                                {Platform.OS === 'web'
                                    ? 'Purchase and restore in the Tally iOS or Android app.'
                                    : !available
                                      ? 'Purchases are unavailable in this build.'
                                      : !session.isAuthenticated
                                        ? 'Sign in or create an account to purchase or restore.'
                                        : 'Subscriptions renew automatically. Cancel in your store settings. Lifetime is a one-time purchase.'}
                            </Text>
                            <View style={styles.legalLinks}>
                                <AuthLink href='/legal/terms' style={styles.textAction} textStyle={styles.legalText}>
                                    Terms
                                </AuthLink>
                                <Text aria-hidden style={styles.copy}>
                                    ·
                                </Text>
                                <AuthLink href='/legal/privacy' style={styles.textAction} textStyle={styles.legalText}>
                                    Privacy
                                </AuthLink>
                            </View>
                        </View>
                    </View>
                </ScrollView>
                <Snackbar message={message} onDismiss={() => setMessage('')} />
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    navigation: { paddingHorizontal: 24, paddingVertical: 8 },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },
    content: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 28 },
    intro: { gap: 8, paddingTop: 8 },
    title: { fontSize: 34, flexShrink: 1 },
    subtitle: { color: colors.muted, fontSize: 18, lineHeight: 26 },
    benefits: { gap: 14 },
    benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    benefitText: { flex: 1, color: colors.text, fontSize: 16, lineHeight: 24 },
    freeAccount: { gap: 6, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.divider },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
    copy: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    signIn: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6 },
    planSection: { gap: 10 },
    planHeading: { gap: 6, marginBottom: 4 },
    plan: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.surface,
        borderRadius: 14,
    },
    planSelected: { borderColor: colors.link },
    pressed: { opacity: 0.8 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
    radioSelected: { borderColor: colors.link, alignItems: 'center', justifyContent: 'center' },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.link },
    planCopy: { flex: 1, gap: 4 },
    planName: { color: colors.text, fontSize: 17, fontWeight: '600' },
    priceBlock: { alignItems: 'flex-end', gap: 2 },
    price: { color: colors.text, fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
    activeAccess: { gap: 8, padding: 20, backgroundColor: colors.surface, borderRadius: 14 },
    actions: { gap: 10 },
    purchaseButton: { ...formStyles.primaryButton, padding: 14 },
    disabled: { opacity: 0.65 },
    disclosure: { textAlign: 'center' },
    textAction: {
        minHeight: 48,
        minWidth: 48,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
    },
    restoreButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    restoreText: { color: colors.link, fontSize: 15, fontWeight: '600' },
    legalLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    legalText: { color: colors.muted, fontSize: 13, fontWeight: '400' },
});
