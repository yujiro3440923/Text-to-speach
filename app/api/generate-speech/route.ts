import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { calculateSpeakingRate } from '@/lib/audioUtils';

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: Request) {
  try {
    const { text, voiceName, targetSeconds } = await request.json();

    if (!text || !targetSeconds) {
      return NextResponse.json({ error: 'Text and targetSeconds are required.' }, { status: 400 });
    }

    const supabase = await createClient();

    // API Key retrieval needs to be secure. 
    // Ideally use Service Role or Env Var. 
    // Assuming logged in user has access to org config for now via RLS or logic.
    // However, `createClient` uses standard headers.
    // If RLS prevents reading organizations, this fails.
    // For this refactor, we stick to the existing pattern but ensure safety.

    // NOTE: In a real production app with RLS, we should use a Service Role client 
    // for reading system-wide configurations like API keys, 
    // OR ensure the user belongs to the organization.
    // Here we query as the user.

    const { data: orgData, error: dbError } = await supabase
      .from('organizations')
      .select('google_api_key')
      .eq('id', DEMO_ORG_ID)
      .single();

    if (dbError || !orgData?.google_api_key) {
      console.error('Organization or Key not found', dbError);
      return NextResponse.json({ error: 'System Configuration Error: API Key not found.' }, { status: 500 });
    }

    const apiKey = orgData.google_api_key.trim();
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    // サーバーサイドで厳密に速度を計算
    const speakingRate = calculateSpeakingRate(text, parseFloat(targetSeconds));

    console.log(`[Generate Speech] Text Length: ${text.length}, Target: ${targetSeconds}s, Calculated Rate: ${speakingRate}`);

    const body = {
      input: { text: text },
      voice: {
        languageCode: 'ja-JP',
        name: voiceName || 'ja-JP-Neural2-B'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: speakingRate
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

    return NextResponse.json({
      audioContent: data.audioContent,
      meta: {
        calculatedRate: speakingRate,
        textLength: text.length
      }
    });

  } catch (error: any) {
    console.error('TTS Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}