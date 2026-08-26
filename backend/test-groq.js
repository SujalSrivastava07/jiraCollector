import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

async function main() {
  try {
    const response = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'Say hello in JSON format like {"msg": "hello"}. Return ONLY valid JSON, nothing else.' }],
      temperature: 0.0,
      max_tokens: 100,
    });
    console.log('SUCCESS:', response.choices[0].message.content);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}
main();
