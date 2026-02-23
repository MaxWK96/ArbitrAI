/**
 * ArbitrAI CRE Workflow — Multi-Model AI Integration
 *
 * Calls three AI models with identical prompts and parses their verdicts.
 * All models receive the same dispute description and evidence — no model
 * has an advantage or receives different information.
 *
 * Models used:
 *  1. Anthropic Claude opus-4-6   (strongest reasoning)
 *  2. OpenAI GPT-4o               (industry reference model)
 *  3. Mistral Large 2             (open-source alternative, diversity of training)
 *
 * The diversity of training data and model architectures is intentional:
 * it reduces the risk of shared biases affecting the verdict.
 *
 * Prize tracks: CRE & AI, AI Agents
 */

import type { ArbitrationPrompt, ParsedModelVerdict, RawModelResponse, VerdictOutcome } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Engineering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The system prompt establishes the AI as a neutral arbitrator.
 * This is identical for all 3 models — no model receives different instructions.
 */
const ARBITRATOR_SYSTEM_PROMPT = `You are an impartial arbitrator for a decentralized dispute resolution system.

Your role:
- Evaluate the evidence submitted by both parties objectively
- Apply principles of fairness, good faith, and common sense
- Consider what a reasonable neutral third party would conclude
- Account for any power imbalances or bad faith behavior

You MUST respond in this exact JSON format (no other text):
{
  "verdict": "FAVOR_PARTY_A" | "FAVOR_PARTY_B" | "INSUFFICIENT_EVIDENCE",
  "confidence": <integer 0-100>,
  "reasoning": "<2-3 sentences explaining your verdict based specifically on the evidence>"
}

Verdict meanings:
- FAVOR_PARTY_A: Party A's position is supported by the evidence
- FAVOR_PARTY_B: Party B's position is supported by the evidence
- INSUFFICIENT_EVIDENCE: The evidence is too unclear/incomplete to render a fair verdict

Be decisive but fair. If you genuinely cannot determine a winner from the evidence, use INSUFFICIENT_EVIDENCE.
Do not add any text before or after the JSON object.`;

function buildUserPrompt(prompt: ArbitrationPrompt): string {
  return `DISPUTE ID: ${prompt.disputeId}

DISPUTE DESCRIPTION:
${prompt.description}

PARTY A (${prompt.partyAAddress}):
${prompt.evidenceA}

PARTY B (${prompt.partyBAddress}):
${prompt.evidenceB}

Based on the above evidence, render your verdict as a neutral arbitrator.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseModelResponse(modelId: string, raw: RawModelResponse): ParsedModelVerdict {
  if (raw.error) {
    console.error(`[${modelId}] Model call failed: ${raw.error}`);
    return {
      modelId,
      vote: 'CIRCUIT_BREAKER',
      confidencePct: 0,
      reasoning: `Model failed: ${raw.error}`,
      parseSuccess: false,
    };
  }

  try {
    // Extract JSON from the response (handle markdown code blocks if model misbehaves)
    const jsonMatch = raw.rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON found in response: ${raw.rawText.slice(0, 200)}`);
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      verdict: string;
      confidence: number;
      reasoning: string;
    };

    // Validate verdict is one of the allowed values
    const allowedVerdicts: VerdictOutcome[] = [
      'FAVOR_PARTY_A',
      'FAVOR_PARTY_B',
      'INSUFFICIENT_EVIDENCE',
    ];

    if (!allowedVerdicts.includes(parsed.verdict as VerdictOutcome)) {
      throw new Error(`Invalid verdict value: ${parsed.verdict}`);
    }

    const confidence = Math.max(0, Math.min(100, Math.round(parsed.confidence)));

    console.log(`[${modelId}] Vote: ${parsed.verdict} (${confidence}%) in ${raw.durationMs}ms`);

    return {
      modelId,
      vote: parsed.verdict as VerdictOutcome,
      confidencePct: confidence,
      reasoning: parsed.reasoning || 'No reasoning provided',
      parseSuccess: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${modelId}] Parse error: ${msg}`);
    console.error(`[${modelId}] Raw response: ${raw.rawText.slice(0, 500)}`);
    return {
      modelId,
      vote: 'CIRCUIT_BREAKER',
      confidencePct: 0,
      reasoning: `Parse error: ${msg}`,
      parseSuccess: false,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Model Callers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call Claude via the CRE HTTP capability.
 *
 * In the WASM environment, we use the CRE SDK's http.fetch() instead of
 * the Anthropic SDK directly. The request body is base64-encoded per CRE spec.
 */
async function callClaude(
  prompt: ArbitrationPrompt,
  apiKey: string,
  httpFetch: HttpFetchFn
): Promise<RawModelResponse> {
  const modelId = 'claude-opus-4-6';
  const start = Date.now();

  try {
    const body = JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: ARBITRATOR_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(prompt),
        },
      ],
    });

    const response = await httpFetch({
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      // CRE HTTP body must be base64-encoded for POST requests
      body: Buffer.from(body).toString('base64'),
    });

    const responseText = Buffer.from(response.body).toString('utf-8');
    const responseJson = JSON.parse(responseText) as {
      content: Array<{ type: string; text: string }>;
      error?: { message: string };
    };

    if (responseJson.error) {
      throw new Error(responseJson.error.message);
    }

    const text = responseJson.content[0]?.text ?? '';

    return { modelId, rawText: text, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { modelId, rawText: '', durationMs: Date.now() - start, error: msg };
  }
}

/**
 * Call GPT-4o via the CRE HTTP capability.
 */
async function callGPT4(
  prompt: ArbitrationPrompt,
  apiKey: string,
  httpFetch: HttpFetchFn
): Promise<RawModelResponse> {
  const modelId = 'gpt-4o';
  const start = Date.now();

  try {
    const body = JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: ARBITRATOR_SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(prompt) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent verdicts
    });

    const response = await httpFetch({
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: Buffer.from(body).toString('base64'),
    });

    const responseText = Buffer.from(response.body).toString('utf-8');
    const responseJson = JSON.parse(responseText) as {
      choices: Array<{ message: { content: string } }>;
      error?: { message: string };
    };

    if (responseJson.error) {
      throw new Error(responseJson.error.message);
    }

    const text = responseJson.choices[0]?.message?.content ?? '';

    return { modelId, rawText: text, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { modelId, rawText: '', durationMs: Date.now() - start, error: msg };
  }
}

/**
 * Call Mistral Large via the CRE HTTP capability.
 *
 * Mistral provides architectural diversity — different training data,
 * different RLHF pipeline, different biases. This reduces correlated errors.
 */
async function callMistral(
  prompt: ArbitrationPrompt,
  apiKey: string,
  httpFetch: HttpFetchFn
): Promise<RawModelResponse> {
  const modelId = 'mistral-large-2411';
  const start = Date.now();

  try {
    const body = JSON.stringify({
      model: 'mistral-large-2411',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: ARBITRATOR_SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(prompt) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const response = await httpFetch({
      method: 'POST',
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: Buffer.from(body).toString('base64'),
    });

    const responseText = Buffer.from(response.body).toString('utf-8');
    const responseJson = JSON.parse(responseText) as {
      choices: Array<{ message: { content: string } }>;
      error?: { message: string };
    };

    if (responseJson.error) {
      throw new Error(responseJson.error.message);
    }

    const text = responseJson.choices[0]?.message?.content ?? '';

    return { modelId, rawText: text, durationMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { modelId, rawText: '', durationMs: Date.now() - start, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Fetch Abstraction
// ─────────────────────────────────────────────────────────────────────────────

/** CRE SDK HTTP fetch signature */
export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string; // base64-encoded
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
}

export type HttpFetchFn = (req: HttpRequest) => Promise<HttpResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query all three AI models in parallel and return parsed verdicts.
 * Models are called simultaneously to minimize total latency.
 * Any model that fails returns CIRCUIT_BREAKER (handled by consensus engine).
 */
export async function queryAllModels(
  prompt: ArbitrationPrompt,
  secrets: { anthropicKey: string; openaiKey: string; mistralKey: string },
  httpFetch: HttpFetchFn
): Promise<[ParsedModelVerdict, ParsedModelVerdict, ParsedModelVerdict]> {
  console.log(`[models] Querying 3 AI models in parallel for dispute ${prompt.disputeId}`);

  // All 3 called simultaneously — total time = max(individual times), not sum
  const [claudeRaw, gpt4Raw, mistralRaw] = await Promise.all([
    callClaude(prompt, secrets.anthropicKey, httpFetch),
    callGPT4(prompt, secrets.openaiKey, httpFetch),
    callMistral(prompt, secrets.mistralKey, httpFetch),
  ]);

  const claudeVerdict = parseModelResponse('claude-opus-4-6', claudeRaw);
  const gpt4Verdict = parseModelResponse('gpt-4o', gpt4Raw);
  const mistralVerdict = parseModelResponse('mistral-large-2411', mistralRaw);

  console.log(`[models] Results:`);
  console.log(`  Claude:  ${claudeVerdict.vote} (${claudeVerdict.confidencePct}%)`);
  console.log(`  GPT-4o:  ${gpt4Verdict.vote} (${gpt4Verdict.confidencePct}%)`);
  console.log(`  Mistral: ${mistralVerdict.vote} (${mistralVerdict.confidencePct}%)`);

  return [claudeVerdict, gpt4Verdict, mistralVerdict];
}
