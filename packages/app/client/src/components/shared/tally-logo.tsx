import Svg, { Path } from 'react-native-svg';

// Each mark matches the "l" in Quicksand Bold: 0.12em wide, 0.74em tall, round ends. `size` is the font size.
export function TallyLogo({ color, size }: { color: string; size: number }) {
    return (
        <Svg
            aria-hidden
            width={size * 1.2}
            height={size * 0.74}
            viewBox='-180 0 1200 740'
            fill='none'
            stroke={color}
            strokeWidth={120}
            strokeLinecap='round'
        >
            <Path d='M60 60V680M300 60V680M540 60V680M780 60V680M-120 600L960 140' />
        </Svg>
    );
}
