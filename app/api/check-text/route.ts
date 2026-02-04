import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: Request) {
  try {
    const { text, seconds } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: orgData, error: dbError } = await supabase
      .from('organizations')
      .select('openai_api_key')
      .eq('id', DEMO_ORG_ID)
      .single();

    if (dbError || !orgData?.openai_api_key) {
      return NextResponse.json({ error: 'OpenAI APIキーが設定されていません。' }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: orgData.openai_api_key,
    });

    const systemPrompt = `
あなたはプロのラジオ放送原稿ライターです。
与えられた原稿を指定された秒数でちょうど読み終わるように調整してください。

# 厳守ルール:
1. 出力は「修正後の原稿テキストのみ」を行ってください。「調整しました」「以下が原稿です」などの前置きや挨拶は一切禁止です。
2. 記号（---など）も不要です。
3. 日本語の読み上げ速度は1秒あたり約5.5文字を目安にしてください。
4. 原稿の意味や雰囲気を損なわないこと。
5. 自然な言い回しを保つこと。
    `;

    const userContent = `
以下の原稿を、${seconds}秒程度で読み終わるように調整してください。

原稿:
${text}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    // 余計な空白や改行を削除して返す
    const revisedText = completion.choices[0].message.content?.trim();

    return NextResponse.json({ result: revisedText });

  } catch (error: any) {
    console.error('OpenAI Error:', error);
    return NextResponse.json({ error: 'AI生成エラー: ' + error.message }, { status: 500 });
  }
}