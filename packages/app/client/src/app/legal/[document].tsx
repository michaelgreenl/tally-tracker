import { Link, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isLegalDocumentKey, legalDocumentKeys, legalDocuments } from '../../legal-documents';

export function generateStaticParams() {
    return legalDocumentKeys.map((document) => ({ document }));
}

export default function LegalDocumentScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ document: string | string[] }>();
    const documentKey = Array.isArray(params.document) ? params.document[0] : params.document;

    if (!documentKey || !isLegalDocumentKey(documentKey)) return <Redirect href='/' />;

    const document = legalDocuments[documentKey];

    return (
        <>
            <Head>
                <title>{`${document.title} | Tally Tracker`}</title>
            </Head>
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.content}>
                    <Pressable
                        accessibilityRole='button'
                        hitSlop={8}
                        onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
                    >
                        <Text style={styles.backLink}>Back</Text>
                    </Pressable>

                    <Text accessibilityRole='header' aria-level={1} style={styles.title}>
                        {document.title}
                    </Text>
                    <Text style={styles.updated}>Last updated: {document.updated}</Text>
                    <Text style={styles.paragraph}>{document.introduction}</Text>

                    {document.sections.map((section) => (
                        <View key={section.title} style={styles.section}>
                            <Text accessibilityRole='header' aria-level={2} style={styles.sectionTitle}>
                                {section.title}
                            </Text>
                            {section.paragraphs.map((paragraph) => (
                                <Text key={paragraph} style={styles.paragraph}>
                                    {paragraph}
                                </Text>
                            ))}
                        </View>
                    ))}

                    <View accessibilityLabel='Legal pages' accessibilityRole='summary' style={styles.navigation}>
                        {legalDocumentKeys.map((key) => (
                            <Link key={key} href={{ pathname: '/legal/[document]', params: { document: key } }} asChild>
                                <Pressable accessibilityRole='link' hitSlop={8}>
                                    <Text style={styles.navigationLink}>{legalDocuments[key].title}</Text>
                                </Pressable>
                            </Link>
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    content: {
        width: '100%',
        maxWidth: 780,
        alignSelf: 'center',
        padding: 24,
        paddingBottom: 48,
    },
    backLink: {
        alignSelf: 'flex-start',
        marginBottom: 28,
        color: '#167ca3',
        fontSize: 16,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    title: {
        color: '#212529',
        fontSize: 36,
        fontWeight: '800',
        lineHeight: 42,
    },
    updated: {
        marginTop: 8,
        marginBottom: 24,
        color: '#575e64',
        fontSize: 14,
    },
    section: {
        marginTop: 22,
    },
    sectionTitle: {
        marginBottom: 8,
        color: '#343a40',
        fontSize: 21,
        fontWeight: '700',
    },
    paragraph: {
        marginBottom: 12,
        color: '#343a40',
        fontSize: 16,
        lineHeight: 25,
    },
    navigation: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 18,
        marginTop: 34,
        paddingTop: 22,
        borderTopWidth: 1,
        borderTopColor: '#ced4da',
    },
    navigationLink: {
        color: '#167ca3',
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});
