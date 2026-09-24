import Svg, { Path } from 'react-native-svg';

export function TallyLogo({ color, size }: { color: string; size: number }) {
    return (
        <Svg aria-hidden width={size} height={size} viewBox='1 1 22 21' fill={color}>
            <Path d='M6 20c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1s1 .4 1 1v14c0 .6-.4 1-1 1zM10 20c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1s1 .4 1 1v14c0 .6-.4 1-1 1zM14 20c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1s1 .4 1 1v14c0 .6-.4 1-1 1zM18 20c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1s1 .4 1 1v14c0 .6-.4 1-1 1z' />
            <Path d='M3 18c-.4 0-.7-.2-.9-.5-.2-.5-.1-1.1.4-1.4l18-10c.5-.2 1.1-.1 1.4.4.2.5.1 1.1-.4 1.4l-18 10c-.2.1-.3.1-.5.1z' />
        </Svg>
    );
}
