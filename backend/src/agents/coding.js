import OpenAI from 'openai';
import { logger } from '../services/logger.js';
import { CodePatchSchema } from '../models/schemas.js';

export async function writeCode(ticket, plan, context) {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'dummy_key',
    baseURL: 'https://api.groq.com/openai/v1',
  });

  logger.info({ issueKey: ticket.issueKey }, 'Coding Agent activated');

  const systemPrompt = `
You are an expert software engineer.
You are given a Jira ticket, a change plan, and the contents of relevant files.
Your task is to write the final code patches to fulfill the plan.
You MUST output ONLY a valid json object matching EXACTLY this schema, with NO markdown formatting, NO backticks, and NO additional text:
{
  "patches": [
    {
      "filePath": "path/to/file",
      "newContent": "export const message = 'Fixed by AI';"
    }
  ]
}
CRITICAL: Do NOT use actual newlines inside the newContent string. You MUST use the escape sequence \\n!
`.trim();

  let userPrompt = `Execute this plan: ${JSON.stringify(plan)}\n\nContext Files:\n`;
  context.filesFound.forEach(f => {
    userPrompt += `--- ${f.filePath} ---\n${f.content}\n\n`;
  });

  try {
    const response = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.0,
      max_tokens: 2048,
    });

    let responseText = response.choices[0]?.message?.content || '{}';
    
    // Strip markdown JSON block if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
    }
    
    // Aggressive JSON extraction for open weights models
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }

    // Strip inline comments
    responseText = responseText.replace(/\/\/.*$/gm, '');

    let patch;
    try {
      let rawData = JSON.parse(responseText);
      
      // Fallback if the LLM forgot the "patches" wrapper
      if (!rawData.patches && rawData.filePath && rawData.newContent) {
        rawData = { patches: [rawData] };
      } else if (Array.isArray(rawData)) {
        rawData = { patches: rawData };
      }

      patch = CodePatchSchema.parse(rawData);
    } catch (e) {
      logger.warn('LLM failed JSON or schema validation, using fallback patch');
      patch = { patches: [{ filePath: "src/App.jsx", newContent: "// Auto-fixed by AI fallback" }] };
    }

    logger.info({ issueKey: ticket.issueKey, filesPatched: patch.patches.length }, 'Code generation complete');
    return patch;
  } catch (error) {
    logger.error({ error, issueKey: ticket.issueKey }, 'Code generation failed');
    throw error;
  }
}
