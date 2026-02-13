/**
 * 標準的な話速 (文字/秒)
 * 日本語のアナウンサー読みの目安。
 */
export const STANDARD_CHARS_PER_SEC = 5.5;

/**
 * テキストと目標時間から、Google Cloud TTSに必要な speakingRate を算出する。
 * 
 * 計算式: 
 * 標準所要時間 = 文字数 / 5.5
 * 必要速度(Rate) = 標準所要時間 / 目標秒数
 *
 * @param text 読み上げ対象テキスト
 * @param targetSeconds 目標秒数
 * @returns speakingRate (0.25 ~ 4.0 の範囲で丸めた値)
 */
export const calculateSpeakingRate = (text: string, targetSeconds: number): number => {
    if (!text || targetSeconds <= 0) return 1.0;

    // 空白や改行を除去した純粋な文字数で計算するか、
    // あるいは読みの間を考慮してそのままカウントするかだが、
    // 一般的には「読み文字数」ベース。簡便のためlengthを使うが、
    // 改行が多い場合は除去したほうが精度が良い場合もある。
    // 今回は「放送原稿」なので、文字数（空白含む）で概算するが、
    // 連続する空白は1文字扱いにするなどの調整を入れても良い。
    // ここではシンプルに length で計算し、係数 5.5 で調整する。

    const charCount = text.length;
    const standardDuration = charCount / STANDARD_CHARS_PER_SEC;

    let rate = standardDuration / targetSeconds;

    // Google TTSの制限 (0.25 ~ 4.0)
    if (rate < 0.25) rate = 0.25;
    if (rate > 4.0) rate = 4.0;

    // 小数点第2位まで丸める
    return Math.round(rate * 100) / 100;
};
