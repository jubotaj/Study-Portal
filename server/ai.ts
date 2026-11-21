import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type {
  AcademicProfile,
  CareerGuidanceResult,
  Program,
  Scholarship,
  SupportMessage,
  SystemPerformanceReport,
  UserFeedback,
} from '../src/types.ts';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown AI error');
  const errObj = err && typeof err === 'object' ? (err as { status?: unknown }) : null;
  let code = typeof errObj?.status === 'number' ? errObj.status : 500;
  let apiStatus = '';
  let apiMessage = raw;

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    if (parsed?.error) {
      code = Number(parsed.error.code) || code;
      apiStatus = String(parsed.error.status || '');
      apiMessage = String(parsed.error.message || raw);
    }
  } catch {
    // Not JSON-formatted
  }

  if (code === 403 || apiStatus === 'PERMISSION_DENIED' || raw.includes('PERMISSION_DENIED')) {
    const detail = apiMessage && apiMessage !== raw ? apiMessage : raw;
    return {
      status: 422,
      message: `Gemini API access denied (403): ${detail} Check GEMINI_API_KEY and billing/API permissions in Settings > Secrets.`,
    };
  }
  if (code === 400 || apiStatus === 'API_KEY_INVALID' || raw.includes('API_KEY_INVALID')) {
    return {
      status: 422,
      message: 'The configured GEMINI_API_KEY is invalid. Please check Settings > Secrets.',
    };
  }
  if (code === 429 || apiStatus === 'RESOURCE_EXHAUSTED' || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Gemini API quota exceeded (429). Please retry shortly or select a billing-enabled API key in Settings > Secrets.',
    };
  }
  if (code === 404 || apiStatus === 'NOT_FOUND') {
    return {
      status: 422,
      message: 'Requested Gemini model is unavailable for this key.',
    };
  }
  return { status: code >= 400 && code < 600 && code !== 403 ? code : 500, message: apiMessage };
}

function parseModelJson<T>(rawText: string | undefined): T {
  const trimmed = (rawText ?? '').trim();
  const unwrapped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (!unwrapped) {
    throw new Error('Gemini returned an empty structured response.');
  }
  return JSON.parse(unwrapped) as T;
}

export async function generateStudentChatReply(params: {
  studentName: string;
  tier: string;
  profile: AcademicProfile;
  question: string;
  programs: Program[];
  scholarships: Scholarship[];
}): Promise<string> {
  const ai = getClient();
  const contextCatalog = {
    programs: params.programs.map((p) => ({
      id: p.id,
      university: p.university,
      country: p.country,
      title: p.title,
      degree: p.degreeLevel,
      tuitionUsd: p.tuitionUsd,
      deadline: p.deadline,
    })),
    scholarships: params.scholarships.map((s) => ({
      name: s.name,
      country: s.country,
      amountUsd: s.amountUsd,
      minGpa: s.minGpa,
      deadline: s.deadline,
    })),
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Student: ${params.studentName} (Tier: ${params.tier})
Profile: GPA ${params.profile.gpa}, Target ${params.profile.degreeTarget} in ${params.profile.field}, Countries: ${params.profile.targetCountries.join(', ')}, Financial need: ${params.profile.financialNeed}, English: ${params.profile.englishScore}.
Catalog snapshot: ${JSON.stringify(contextCatalog)}
Student Question: ${params.question}`,
    config: {
      systemInstruction:
        'You are the StudyGlobe Admissions & Career Advisor AI. Provide accurate, concise, actionable guidance grounded in the student profile and catalog. Mention concrete deadlines, GPA thresholds, and next steps in plain clean prose (under 180 words).',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return (response.text ?? 'Unable to generate guidance at this moment.').trim();
}

export async function matchScholarshipsAndCareer(params: {
  studentName: string;
  profile: AcademicProfile;
  programs: Program[];
  scholarships: Scholarship[];
}): Promise<CareerGuidanceResult> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Analyze this international student profile and match against the available scholarships and university programs. Today's date is 2026-11-19.
Student: ${params.studentName}
Profile: ${JSON.stringify(params.profile)}
Programs: ${JSON.stringify(params.programs)}
Scholarships: ${JSON.stringify(params.scholarships)}`,
    config: {
      systemInstruction:
        'You are an international admissions & scholarship matching engine. Score each scholarship (0-100) and evaluate top matching universities with realistic admissionProbability (0-100), chanceLabel, rationale, and requiredDocuments. Return only IDs that exist in the provided lists.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          careerSummary: { type: Type.STRING },
          recommendedRoles: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          skillGapsToClose: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          recommendedProgramIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          universityMatches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                programId: { type: Type.STRING },
                university: { type: Type.STRING },
                admissionProbability: { type: Type.INTEGER },
                chanceLabel: { type: Type.STRING },
                rationale: { type: Type.STRING },
                requiredDocuments: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
          },
          scholarshipMatches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                scholarshipId: { type: Type.STRING },
                scholarshipName: { type: Type.STRING },
                matchScore: { type: Type.INTEGER },
                rationale: { type: Type.STRING },
                urgencyLevel: { type: Type.STRING },
                actionSteps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return parseModelJson<CareerGuidanceResult>(response.text);
}

export async function generateRealLifeCatalogAdditions(params: {
  existingPrograms: Program[];
  existingScholarships: Scholarship[];
  focusRegion?: string;
}): Promise<{
  newProgram: Omit<Program, 'id' | 'addedBy' | 'imageUrl'>;
  newScholarship: Omit<Scholarship, 'id' | 'addedBy'>;
}> {
  const ai = getClient();
  const existingNames = params.existingPrograms.map((p) => `${p.university} - ${p.title}`);
  const existingSch = params.existingScholarships.map((s) => s.name);

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Generate 1 real-world international university graduate/undergraduate degree program and 1 real-world international scholarship that are NOT already in these lists.
Focus region preference: ${params.focusRegion || 'Global (Europe, Asia-Pacific, or North America)'}
Existing programs: ${existingNames.join('; ')}
Existing scholarships: ${existingSch.join('; ')}
Use realistic 2027 admission deadlines (YYYY-MM-DD format), accurate tuition estimates in USD, and accurate QS rank.`,
    config: {
      systemInstruction:
        'You are the autonomous StudyGlobe data curator. Provide real-life, factual international university programs and scholarships.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          newProgram: {
            type: Type.OBJECT,
            properties: {
              university: { type: Type.STRING },
              country: { type: Type.STRING },
              city: { type: Type.STRING },
              title: { type: Type.STRING },
              degreeLevel: { type: Type.STRING },
              field: { type: Type.STRING },
              tuitionUsd: { type: Type.INTEGER },
              deadline: { type: Type.STRING },
              acceptanceRate: { type: Type.STRING },
              qsRank: { type: Type.INTEGER },
              language: { type: Type.STRING },
              applicationFeeUsd: { type: Type.INTEGER },
            },
          },
          newScholarship: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              provider: { type: Type.STRING },
              country: { type: Type.STRING },
              coverage: { type: Type.STRING },
              amountUsd: { type: Type.INTEGER },
              deadline: { type: Type.STRING },
              minGpa: { type: Type.NUMBER },
              needBased: { type: Type.BOOLEAN },
              eligibleDegrees: { type: Type.ARRAY, items: { type: Type.STRING } },
              eligibleFields: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      },
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return parseModelJson<{
    newProgram: Omit<Program, 'id' | 'addedBy' | 'imageUrl'>;
    newScholarship: Omit<Scholarship, 'id' | 'addedBy'>;
  }>(response.text);
}

export async function generateModeratorAutoReply(params: {
  inquiry: SupportMessage;
  programs: Program[];
  scholarships: Scholarship[];
}): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Student ${params.inquiry.studentName} asked: "${params.inquiry.content}".
Available catalog count: ${params.programs.length} programs, ${params.scholarships.length} scholarships.
Draft a helpful, direct, professional reply on behalf of the StudyGlobe Admissions Desk.`,
    config: {
      systemInstruction:
        'Respond concisely (max 110 words) with specific admissions guidance and next actions.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  return (response.text ?? 'Thank you for reaching out. Our admissions team has logged your query.').trim();
}

export async function analyzeFeedbackForCustomizations(params: {
  feedbacks: UserFeedback[];
  existingKeys: string[];
}): Promise<{
  key: string;
  label: string;
  description: string;
  rationale: string;
}> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `User feedbacks: ${JSON.stringify(params.feedbacks)}
Existing customization keys (do not repeat): ${params.existingKeys.join(', ')}
Propose one concrete UI/UX site customization toggle based on the feedback.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING },
          label: { type: Type.STRING },
          description: { type: Type.STRING },
          rationale: { type: Type.STRING },
        },
      },
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return parseModelJson<{
    key: string;
    label: string;
    description: string;
    rationale: string;
  }>(response.text);
}

export async function analyzeSystemPerformance(
  metrics: SystemPerformanceReport,
): Promise<{
  healthSummary: string;
  recommendations: { title: string; impact: string; action: string }[];
}> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Review live StudyGlobe system telemetry and compliance posture: ${JSON.stringify(metrics)}.
Provide a concise operational summary and 3 proactive engineering or scalability recommendations.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          healthSummary: { type: Type.STRING },
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                impact: { type: Type.STRING },
                action: { type: Type.STRING },
              },
            },
          },
        },
      },
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return parseModelJson<{
    healthSummary: string;
    recommendations: { title: string; impact: string; action: string }[];
  }>(response.text);
}
