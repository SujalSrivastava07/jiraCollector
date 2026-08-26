import OpenAI from 'openai';
import { logger } from '../services/logger.js';
import { ChangePlanSchema } from '../models/schemas.js';

export async function createPlan(ticket, understanding, context) {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'dummy_key',
    baseURL: 'https://api.groq.com/openai/v1',
  });

  logger.info({ issueKey: ticket.issueKey }, 'Planning Agent activated');

  const systemPrompt = `
You are a senior software architect. Your job is to read a Jira ticket, the extracted requirements, and the current codebase context, and produce a step-by-step implementation plan.
Do NOT write the actual code yet. Just write the plan.
You MUST return a json object matching this schema:
{
  "summary": "Brief summary of the approach",
  "filesToModify": ["path/to/existing/file.js"],
  "filesToCreate": ["path/to/new/file.js"],
  "steps": ["Step 1...", "Step 2..."]
}
  `.trim();

  let userPrompt = `Ticket: ${ticket.title}\nRequirements: ${JSON.stringify(understanding.extractedRequirements)}\n\nContext:\n`;
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

    const rawData = JSON.parse(responseText);
    const plan = ChangePlanSchema.parse(rawData);

    logger.info({ issueKey: ticket.issueKey, filesToModify: plan.filesToModify.length }, 'Plan created successfully');
    return plan;
  } catch (error) {
    logger.error({ error, issueKey: ticket.issueKey }, 'Planning failed');
    throw error;
  }
}
