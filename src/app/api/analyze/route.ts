import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt. Bitte in .env.local eintragen.' }, { status: 503 });
  try {
    const form = await request.formData();
    const audio = form.get('audio');
    const knownPeople = String(form.get('people') || '');
    if (!(audio instanceof File)) return NextResponse.json({ error: 'Bitte eine Audiodatei auswählen.' }, { status: 400 });
    if (audio.size > 24 * 1024 * 1024) return NextResponse.json({ error: 'Die Audiodatei ist größer als 24 MB. Bitte kürzen oder komprimieren.' }, { status: 413 });
    const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcription = await ai.audio.transcriptions.create({ file: audio, model: 'whisper-1', language: 'de', response_format: 'text' });
    const transcript = String(transcription).trim();
    if (!transcript) return NextResponse.json({ error: 'Es wurde kein verständlicher Gesprächsinhalt erkannt.' }, { status: 422 });
    const response = await ai.chat.completions.create({
      model: 'gpt-4o-mini', response_format: { type: 'json_object' }, temperature: 0.2,
      messages: [
        { role: 'system', content: `Du bist ein präziser Meeting-Assistent. Analysiere ein deutsches Meeting-Transkript. Antworte ausschließlich als JSON mit den Schlüsseln summary (2-4 Sätze), keyPoints (Array mit 3-6 kurzen Punkten), decisions (Array), todos (Array von Objekten mit title, assignee, dueDate im Format YYYY-MM-DD oder leer, status als "Offen"), speakers (Array möglicher Personen). Ordne Aufgaben nur dann einer Person zu, wenn das Transkript das klar hergibt. Nutze bekannte Teammitglieder, wenn möglich: ${knownPeople || 'keine Angaben'}. Erfinde keine Zusagen, Namen oder Termine; bei Unklarheit assignee="Nicht zugeordnet". Aufgaben müssen konkrete Handlungen sein.` },
        { role: 'user', content: `Transkript:\n${transcript}` }
      ]
    });
    const raw = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(raw);
    return NextResponse.json({ transcript, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler bei der Analyse.';
    return NextResponse.json({ error: `Analyse fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
