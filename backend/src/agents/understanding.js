import OpenAI from 'openai';
import { logger } from '../services/logger.js';
import { UnderstandingResultSchema } from '../models/schemas.js';

// Removed global client

export async function analyzeTicket(ticket) {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'dummy_key',
    baseURL: 'https://api.groq.com/openai/v1',
  });

  logger.info({ issueKey: ticket.issueKey }, 'Analyzing ticket');

  const systemPrompt = `
You are an expert technical product manager and software engineer.
Your task is to analyze a Jira ticket and extract structured requirements.
You MUST return your response as a valid json object matching this schema:
{
  "ticketType": "bug" | "feature" | "refactor" | "chore" | "needs_clarification" | "too_large",
  "ambiguityScore": number (1-10),
  "extractedRequirements": ["req 1", "req 2"],
  "filesReferenced": ["path/to/file.ts"],
  "clarificationQuestions": ["question 1"]
}
  `.trim();

  let userPrompt = `Analyze this Jira Ticket:\nTitle: ${ticket.title}\nDescription: ${ticket.description}\n`;
  ticket.comments.forEach((c, idx) => {
    userPrompt += `Comment ${idx + 1} by ${c.author}: ${c.body}\n`;
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

    const rawData = JSON.parse(responseText);
    
    // Zod will throw an error if the LLM output violates the schema
    const result = UnderstandingResultSchema.parse(rawData);

    logger.info({ issueKey: ticket.issueKey, type: result.ticketType, ambiguity: result.ambiguityScore }, 'Ticket analysis complete');
    
    return result;
  } catch (error) {
    logger.error({ error, issueKey: ticket.issueKey }, 'Failed to analyze ticket');
    throw error;
  }
}
