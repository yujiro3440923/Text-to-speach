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
      .limit(1)
      .single();

    // Prioritize DB Key, fallback to Env
    let apiKey = process.env.OPENAI_API_KEY;
    if (orgData?.openai_api_key) {
      apiKey = orgData.openai_api_key;
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI APIキーが設定されていません。' }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const targetCharCount = Math.floor(seconds * 5.5);
    const currentLatentCount = text.length;
    let instructionType = 'adjust';

    // 判定ロジック: 20%以上の乖離でモード切替
    if (currentLatentCount < targetCharCount * 0.8) {
      instructionType = 'expand';
    } else if (currentLatentCount > targetCharCount * 1.2) {
      instructionType = 'summarize';
    }

    const systemPrompt = `
あなたはプロのラジオ構成作家です。
提供された原稿を、放送で読み上げるための「完動品」としてリライトしてください。

# 重要ミッション:
指定された目標文字数（${targetCharCount}文字）前後になるように、内容を${instructionType === 'expand' ? '膨らませて' : instructionType === 'summarize' ? '要約して' : '調整して'}ください。

# 厳守ルール:
1. 出力は「放送原稿の本文のみ」を返してください。挨拶、説明、マークダウンの装飾、メタ発言（「以下が原稿です」など）は一切禁止です。
2. 読み上げ速度は「1秒あたり5.5文字」です。このリズム感を意識した、耳で聞いてわかりやすい文章にしてください。
3. ${instructionType === 'expand' ? 'エピソードや形容詞、具体的な描写を書き足して、尺を埋めてください。' : instructionType === 'summarize' ? '重要なメッセージを残しつつ、冗長な表現を削ぎ落としてください。' : '微調整を行い、時間ピッタリに収めてください。'}
4. 放送事故を防ぐため、公序良俗に反する内容は含めないでください。
    `;

    const userContent = `
【目標】${seconds}秒（約${targetCharCount}文字）
【現状】約${text.length}文字
【指示】${instructionType === 'expand' ? '尺が余っています。話を広げてください。' : instructionType === 'summarize' ? '尺が足りません（長すぎます）。要約してください。' : '尺を合わせてください。'}

【原稿】
${text}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // より賢いモデルを使用推奨
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
    });

    const revisedText = completion.choices[0].message.content?.trim();

    return NextResponse.json({
      result: revisedText,
      meta: {
        targetChars: targetCharCount,
        mode: instructionType
      }
    });

  } catch (error: any) {
    console.error('OpenAI Error:', error);
    return NextResponse.json({ error: 'AI生成エラー: ' + error.message }, { status: 500 });
  }
}