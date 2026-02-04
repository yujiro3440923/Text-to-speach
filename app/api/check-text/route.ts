import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// 設定画面と同じデモ用ID（本番ではログインユーザーのIDなど動的な値にします）
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: Request) {
  try {
    const { text, seconds } = await request.json();

    // 1. Supabaseに接続して、保存されているAPIキーを取りに行く
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
      console.error("DB Error:", dbError);
      return NextResponse.json({ error: '設定画面でOpenAI APIキーが設定されていません。' }, { status: 400 });
    }

    const apiKey = orgData.openai_api_key;

    // 2. 取得したキーを使ってOpenAIを初期化
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // ラジオの目安: 1分間で約300~350文字
    const targetCharCount = Math.floor((350 / 60) * seconds);

    const systemPrompt = `
あなたはプロのラジオ構成作家です。
提供された原稿を、アナウンサーが「${seconds}秒」で読み切れるようにリライトしてください。

# 制約条件
1. 話し言葉として自然な日本語にしてください。
2. 目標文字数は約${targetCharCount}文字ですが、意味が通じることを最優先してください。
3. 指定秒数に対して内容が多すぎる場合は、重要な情報を残して要約してください。
4. 指定秒数に対して内容が少なすぎる場合は、情景描写や挨拶を丁寧に補ってください。
5. 出力は「修正後の原稿テキストのみ」を行ってください。余計な説明は不要です。
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    });

    const revisedText = completion.choices[0].message.content;

    return NextResponse.json({ result: revisedText });

  } catch (error: any) {
    console.error('OpenAI Error:', error);
    return NextResponse.json({ error: 'AI生成中にエラーが発生しました: ' + error.message }, { status: 500 });
  }
}