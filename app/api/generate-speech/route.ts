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
    if (!apiKey) {
      const { data: demoOrg } = await supabase
        .from('organizations')
        .select('google_api_key')
        .eq('id', DEMO_ORG_ID)
        .single();

      if (demoOrg?.google_api_key) {
        apiKey = demoOrg.google_api_key;
      }
    }

    if (!apiKey) {
      console.error('System Configuration Error: API Key not found in Env or DB.');
      return NextResponse.json({ error: 'System Configuration Error: API Key not found. Please set GOOGLE_API_KEY in Vercel or Database.' }, { status: 500 });
    }

    apiKey = apiKey.trim();
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    // --- PASS 1: Measurement ---
    // Generate at standard 1.0x speed to measure "natural" duration

    let ssmlInput = inputContent;
    // Simple sanitization: Strip non-SSML tags if possible? 
    // For now, let's just ensure <speak> wrap.
    // Also strip generic <span> or <div> if they don't have ssml attributes, but that's hard with regex.
    // Let's rely on frontend sending mostly clean HTML, but ensure <speak>.

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

    // Safety Wrap for Duration & 2nd Pass
    try {
      naturalDuration = await getAudioDuration(buffer1);
      console.log(`[Two-Pass] Natural Duration: ${naturalDuration}s`);

      // --- Calculate Correction ---
      let adjustedRate = naturalDuration / parseFloat(targetSeconds);

      // Clamp for API limits (0.25 - 4.0)
      if (adjustedRate < 0.25) adjustedRate = 0.25;
      if (adjustedRate > 4.0) adjustedRate = 4.0;

      adjustedRate = Math.round(adjustedRate * 100) / 100;

      console.log(`[Two-Pass] Target: ${targetSeconds}s, New Rate: ${adjustedRate}`);

      // Google TTS rate deviation needs correction?
      // If rate is effectively 1.0 (within margin), we can skip.
      if (Math.abs(adjustedRate - 1.0) > 0.05) {
        // --- PASS 2: Generation with Corrected Rate ---
        const bodyPass2 = {
          ...bodyPass1,
          audioConfig: {
            ...bodyPass1.audioConfig,
            speakingRate: adjustedRate
          }
        };

        const res2 = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPass2),
        });

        if (!res2.ok) {
          // If Pass 2 fails, log it but return Pass 1 (better than nothing)
          const err = await res2.json();
          console.error('Google API Error (Pass 2):', err);
        } else {
          const data2 = await res2.json();
          finalAudioContent = data2.audioContent;
          finalRate = adjustedRate;
        }
      }
    } catch (innerError) {
      console.error('Two-Pass Optimization Failed (Falling back to 1.0x):', innerError);
      // Fallback: naturalDuration might be 0, calculatedRate 1.0
      // We still return the audio from Pass 1.
    }

    return NextResponse.json({
      audioContent: finalAudioContent,
      meta: {
        calculatedRate: finalRate,
        naturalDuration: naturalDuration,
        textLength: inputContent.length
      }
    });

  } catch (error: any) {
    console.error('TTS Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}