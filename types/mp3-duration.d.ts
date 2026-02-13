declare module 'mp3-duration' {
    export default function mp3Duration(
        buffer: Buffer | string,
        callback?: (err: Error | null, duration: number) => void
    ): Promise<number>;
}
