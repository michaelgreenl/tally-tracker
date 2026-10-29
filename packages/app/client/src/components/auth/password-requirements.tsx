import { PASSWORD_RULES } from '@tally/core/client';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../../theme/colors';

// Unmet rules stay neutral so typing never reads as an error; submit still reports what is missing.
export function PasswordRequirements({ password }: { password: string }) {
    return (
        <View role='list' style={styles.list}>
            {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                    <View
                        accessible
                        accessibilityLabel={`${rule.label}, ${met ? 'met' : 'not met'}`}
                        key={rule.id}
                        role='listitem'
                        style={styles.rule}
                        testID={`password-rule-${rule.id}-${met ? 'met' : 'unmet'}`}
                    >
                        <Svg aria-hidden width={16} height={16} viewBox='0 0 16 16'>
                            {met ? (
                                <>
                                    <Circle cx={8} cy={8} r={8} fill={colors.success} />
                                    <Path
                                        d='m4.75 8.25 2.25 2.25 4.25-4.5'
                                        fill='none'
                                        stroke={colors.surface}
                                        strokeWidth={2}
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    />
                                </>
                            ) : (
                                <Circle cx={8} cy={8} r={6.75} fill='none' stroke={colors.border} strokeWidth={1.5} />
                            )}
                        </Svg>
                        <Text style={[styles.label, met && styles.metLabel]}>{rule.label}</Text>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    list: {
        gap: 6,
        marginTop: 10,
    },
    rule: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    label: {
        flexShrink: 1,
        color: colors.muted,
        fontSize: 13,
    },
    metLabel: {
        color: colors.text,
    },
});
