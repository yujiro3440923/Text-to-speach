import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text, voiceName } = await request.json();
    // 余計な空白が入らないように .trim() で掃除
    const apiKey = process.env.GOOGLE_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is missing' }, { status: 500 });
    }

    // ★修正点: APIキーをURLの後ろに「?key=...」という形でつけます。
    // これが最も標準的でエラーが出にくい方法です。
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    const body = {
      input: { text: text },
      voice: { 
        languageCode: 'ja-JP', 
        name: voiceName || 'ja-JP-Neural2-B'
      },
      audioConfig: { audioEncoding: 'MP3' },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Google API Error:", data);
      throw new Error(data.error?.message || 'Google API Error');
    }

    return NextResponse.json({ audioContent: data.audioContent });

  } catch (error: any) {
    console.error('TTS Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}