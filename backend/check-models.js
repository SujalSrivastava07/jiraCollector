import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });

async function run() {
  const response = await client.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: 'Output {"test": "hello"}' }],
    response_format: { type: "json_object" }
  });
  console.log(response.choices[0].message.content);
}
run();
