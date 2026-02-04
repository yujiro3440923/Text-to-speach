import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { text, seconds } = await request.json();

    // ラジオの目安: 1分間で約300~350文字
    // 目標文字数 = (350文字 / 60秒) * 指定秒数
    const targetCharCount = Math.floor((350 / 60) * seconds);

    const systemPrompt = `
あなたはプロのラジオ構成作家です。
提供された原稿を、アナウンサーが「${seconds}秒」で読み切れるようにリライトしてください。

# 制約条件
1. 話し言葉として自然な日本語にしてください。
2. 目標文字数は約${targetCharCount}文字ですが、意味が通じることを最優先してください。
3. 秒数に対して内容が多すぎる場合は、重要な情報を残して要約してください。
4. 秒数に対して内容が少なすぎる場合は、情景描写や挨拶を丁寧に補ってください。
5. 出力は「修正後の原稿テキストのみ」を行ってください。余計な説明は不要です。
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // 高速・安価なモデル
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    });

    const revisedText = completion.choices[0].message.content;

    return NextResponse.json({ result: revisedText });

  } catch (error) {
    console.error('OpenAI Error:', error);
    return NextResponse.json({ error: 'AI生成中にエラーが発生しました' }, { status: 500 });
  }
}