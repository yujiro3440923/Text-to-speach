import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: Request) {
  try {
    // speakingRate (速度) を受け取るように追加
    const { text, voiceName, speakingRate } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: orgData, error: dbError } = await supabase
      .from('organizations')
      .select('google_api_key')
      .eq('id', DEMO_ORG_ID)
      .single();

    if (dbError || !orgData?.google_api_key) {
      return NextResponse.json({ error: 'Google APIキーが設定されていません。' }, { status: 400 });
    }

    const apiKey = orgData.google_api_key.trim();
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    const body = {
      input: { text: text },
      voice: { 
        languageCode: 'ja-JP', 
        name: voiceName || 'ja-JP-Neural2-B'
      },
      audioConfig: { 
        audioEncoding: 'MP3',
        // 速度設定: 0.25 〜 4.0。 1.0が標準。
        speakingRate: speakingRate || 1.0 
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Google API Error');
    }

    return NextResponse.json({ audioContent: data.audioContent });

  } catch (error: any) {
    console.error('TTS Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}