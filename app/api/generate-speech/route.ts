import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
// import { calculateSpeakingRate } from '@/lib/audioUtils'; // No longer needed for final calculation
import mp3Duration from 'mp3-duration';

// Helper to get duration from buffer
const getAudioDuration = (buffer: Buffer): Promise<number> => {
  return new Promise((resolve, reject) => {
    mp3Duration(buffer, (err: any, duration: number) => {
      if (err) return reject(err);
      resolve(duration);
    });
  });
};

const DEMO_ORG_ID = '148004b3-5683-4ae3-9c87-9bc198275323'; // Hardcoded for prototype

export async function POST(request: Request) {
  try {
    const { text, voiceName, targetSeconds, pitch, ssml } = await request.json();

    // Support both raw text (proto) and ssml (new)
    // If ssml is provided, use it. If not, wrap text.
    const inputContent = ssml || text;

    if (!inputContent || !targetSeconds) {
      return NextResponse.json({ error: 'Text/SSML and targetSeconds are required.' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Try Environment Variable (Best for Vercel/Production)
    let apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      // 2. Try DB (User's Organization)
      const { data: orgData, error: dbError } = await supabase
        .from('organizations')
        .select('google_api_key')
        .limit(1) // Just get the first one available to this user
        .single();

      if (!dbError && orgData?.google_api_key) {
        apiKey = orgData.google_api_key;
      }
    }

    // 3. Last Resort: Hardcoded Demo ID (if RLS allows)
    if (!apiKey && !process.env.FISH_API_KEY) { // Check both
      const { data: demoOrg } = await supabase
        .from('organizations')
        .select('google_api_key, fish_api_key') // Fetch both
        .eq('id', DEMO_ORG_ID)
        .single();

      if (demoOrg?.google_api_key) apiKey = demoOrg.google_api_key;
      // fishKey logic handled below
    }

    // --- Provider Selection ---
    // Default to Google if not specified
    const provider = (request as any).provider || 'google'; // 'google' | 'fish'

    // --- GOOGLE TTS LOGIC ---
    if (provider === 'google') {
      if (!apiKey) {
        // Try getting from DB again if we missed it (refactor opportunity, but keeping simple)
        const { data: orgData } = await supabase.from('organizations').select('google_api_key').limit(1).single();
        if (orgData?.google_api_key) apiKey = orgData.google_api_key;
      }

      if (!apiKey) {
        console.error('Configuration Error: Google API Key not found.');
        return NextResponse.json({ error: 'Google API Key missing.' }, { status: 500 });
      }

      apiKey = apiKey.trim();
      const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

      // --- PASS 1: Measurement ---
      let ssmlInput = inputContent;
      if (!ssmlInput.includes('<speak>')) {
        ssmlInput = `<speak>${ssmlInput}</speak>`;
      }

      const bodyPass1 = {
        input: { ssml: ssmlInput },
        voice: {
          languageCode: 'ja-JP',
          name: voiceName || 'ja-JP-Neural2-B'
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: pitch || 0.0
        },
      };

      const res1 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPass1),
      });

      if (!res1.ok) {
        const err = await res1.json();
        throw new Error(err.error?.message || 'Google API Error (Pass 1)');
      }

      const data1 = await res1.json();
      const buffer1 = Buffer.from(data1.audioContent, 'base64');

      let naturalDuration = 0;
      let finalAudioContent = data1.audioContent;
      let finalRate = 1.0;

      try {
        naturalDuration = await getAudioDuration(buffer1);
        console.log(`[Google Two-Pass] Natural: ${naturalDuration}s, Target: ${targetSeconds}s`);

        let adjustedRate = naturalDuration / parseFloat(targetSeconds);
        if (adjustedRate < 0.25) adjustedRate = 0.25;
        if (adjustedRate > 4.0) adjustedRate = 4.0;
        adjustedRate = Math.round(adjustedRate * 100) / 100;

        if (Math.abs(adjustedRate - 1.0) > 0.05) {
          const bodyPass2 = {
            ...bodyPass1,
            audioConfig: { ...bodyPass1.audioConfig, speakingRate: adjustedRate }
          };

          const res2 = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPass2),
          });

          if (res2.ok) {
            const data2 = await res2.json();
            finalAudioContent = data2.audioContent;
            finalRate = adjustedRate;
          }
        }
      } catch (innerError) {
        console.warn('Google Two-Pass optimization skipped:', innerError);
      }

      return NextResponse.json({
        audioContent: finalAudioContent,
        meta: { calculatedRate: finalRate, naturalDuration, textLength: inputContent.length }
      });
    }

    // --- FISH AUDIO LOGIC ---
    else if (provider === 'fish') {
      // 1. Get Fish Key
      let fishKey = process.env.FISH_API_KEY;
      if (!fishKey) {
        const { data: orgData } = await supabase.from('organizations').select('fish_api_key').limit(1).single();
        if (orgData?.fish_api_key) fishKey = orgData.fish_api_key;
      }

      if (!fishKey) {
        return NextResponse.json({ error: 'Fish Audio API Key missing. Please set it in Settings.' }, { status: 500 });
      }

      // 2. Prepare Request
      // Fish Audio uses msgpack by default usually, but supports JSON?
      // POST https://api.fish.audio/v1/tts
      // Headers: Authorization: Bearer {token}, Content-Type: application/json

      // Default Voice ID if none provided (Need a valid one)
      // Example: '4f96d66948594243867e411f5c66d1f9' (Some random ID, user must provide via voiceName)
      const referenceId = voiceName;

      if (!referenceId) {
        return NextResponse.json({ error: 'Voice ID (reference_id) is required for Fish Audio.' }, { status: 400 });
      }

      // Fish Audio doesn't support generic "targetSeconds" directly.
      // We will skip Two-Pass for Fish Audio for now (complex to recalc speed) 
      // OR implement simple speed adjustment: speed = 1.0.

      // TODO: Implement Two-Pass for Fish if needed. For now, 1.0x.

      const body = {
        text: text, // Fish supports raw text with tags like (happy)
        reference_id: referenceId,
        format: "mp3",
        mp3_bitrate: 128,
        latency: "normal"
      };

      const res = await fetch("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${fishKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Fish Audio API Error: ${errorText}`);
      }

      // Fish returns binary audio directly (buffer), NOT base64 json usually?
      // Wait, doc says "Returns audio data".
      const audioBuffer = await res.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');

      // Calculate duration roughly
      const mp3Buff = Buffer.from(audioBuffer);
      let duration = 0;
      try { duration = await getAudioDuration(mp3Buff); } catch (e) { }

      return NextResponse.json({
        audioContent: base64Audio,
        meta: { calculatedRate: 1.0, naturalDuration: duration, textLength: text.length }
      });
    }

    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });

  } catch (error: any) {
    console.error('TTS Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}