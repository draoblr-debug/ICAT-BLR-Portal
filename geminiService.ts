
import { GoogleGenAI, Type } from "@google/genai";
import { SurveyResponse, Module, AssignmentBrief, RubricCriteria, AIClassModule, QuizDifficulty, AISlide, AIQuizQuestion, LessonPlan, LessonChunk, LessonActivityType, ModuleContext, PeerReviewInput, PeerReviewSynthesisResult, PeerReviewQualityResult } from "../types";

const getAI = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not configured");
    return new GoogleGenAI({ apiKey });
}

// Helper to clean AI response before parsing
const cleanJson = (text: string) => {
    if (!text) return "{}";
    // Remove markdown code blocks (start and end)
    let cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    // Remove any remaining markdown fences if the regex above missed nested/malformed ones
    cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "");
    return cleaned.trim();
};

export const analyzeFeedback = async (
    module: Module,
    surveys: SurveyResponse[]
): Promise<string> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return "API Key not configured. Please set process.env.API_KEY to use Gemini features.";

    const ai = new GoogleGenAI({ apiKey });

    const feedbackTexts = surveys
        .filter(s => s.moduleCode === module.code && s.feedback.length > 5)
        .map(s => `- Rating: ${s.rating}/5. Comment: "${s.feedback}"`)
        .join('\n');

    if (!feedbackTexts) {
        return "No sufficient textual feedback available for analysis.";
    }

    const prompt = `
    You are an expert educational analyst.
    Analyze the following student feedback for the module: "${module.title}" (${module.code}).
    
    Student Feedback Data:
    ${feedbackTexts}
    
    Please provide a concise summary covering:
    1. Key Strengths
    2. Areas for Improvement
    3. A recommended action plan for the tutor.
    
    Keep the tone professional and constructive.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "No analysis generated.";
    } catch (error: any) {
        console.error("Gemini API Error:", error?.message || "Unknown error");
        return "Failed to generate analysis due to an error.";
    }
};

export const generateBriefContent = async (
    moduleTitle: string,
    descriptorText: string,
    numWeeks: number,
    mainDeliverable: string,
    syllabusContext?: string // New parameter for University/Adapted content
): Promise<Partial<AssignmentBrief>> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    const ai = getAI();

    const contextPrompt = syllabusContext ? `
    REFERENCE MATERIAL (University Syllabus / ICAT Adapted Content):
    "${syllabusContext.substring(0, 5000)}"
    
    CRITICAL INSTRUCTION: 
    - The "learningOutcomes" MUST be derived from the "Course Outcomes (COs)" in the reference material above.
    - The "weeklySchedule" must align with the chapters/units defined in the reference material.
    ` : '';

    const prompt = `
    You are a curriculum developer for a Design College. Create a formal Course Brief for the module "${moduleTitle}".
    
    Parameters:
    - Duration: ${numWeeks} weeks.
    - Main Project Requirement: ${mainDeliverable}
    - Module Context: "${descriptorText.substring(0, 1000)}"
    
    ${contextPrompt}

    Requirements:
    1. "learningOutcomes": Generate exactly 5 clear, measurable bullet points (strings) starting with action verbs.
    2. "weeklySchedule": An array of objects for EACH week (Week 1 to Week ${numWeeks}).
       - "weekNumber": Integer.
       - "topic": Short title of the milestone.
       - "description": Instructions for the week.
    3. "finalDeliverableRequirements": Final Project requirements strings.
    4. "deliverables": Generate a submission slot for at least 3 key milestones (e.g. Week 4, Week 8).
       - "title": e.g., "Research Submission", "Final Portfolio".
       - "type": "Image", "Link", "Video", or "PDF".
       - "weekNumber": Integer (when it is due).
       - "rubric": For EACH deliverable, generate a detailed grading rubric array.
         - criteria: string (e.g. "Concept Depth", "Technical Execution").
         - weightage: number (total of all criteria for one deliverable must be 100).
         - levels: Array of EXACTLY 5 objects with "grade" and "description".
           - The grades MUST be: "Excellent", "Very Good", "Good", "Average", "Poor".
           - description: Specific text describing performance at that level.

    IMPORTANT: Return ONLY valid JSON. Strings must be properly escaped.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    learningOutcomes: { type: Type.ARRAY, items: { type: Type.STRING } },
                    weeklySchedule: { 
                        type: Type.ARRAY, 
                        items: { 
                            type: Type.OBJECT,
                            properties: {
                                weekNumber: { type: Type.NUMBER },
                                topic: { type: Type.STRING },
                                description: { type: Type.STRING }
                            }
                        } 
                    },
                    finalDeliverableRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
                    deliverables: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                type: { type: Type.STRING, enum: ["Image", "Link", "Video", "PDF"] },
                                weekNumber: { type: Type.NUMBER },
                                rubric: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            id: { type: Type.STRING },
                                            criteria: { type: Type.STRING },
                                            weightage: { type: Type.NUMBER },
                                            levels: { 
                                                type: Type.ARRAY,
                                                items: {
                                                    type: Type.OBJECT,
                                                    properties: {
                                                        grade: { type: Type.STRING },
                                                        description: { type: Type.STRING }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    try {
        const text = response.text || "{}";
        const parsed = JSON.parse(cleanJson(text));
        
        // Post-process to ensure IDs
        parsed.deliverables?.forEach((d: any) => {
            if(!d.id) d.id = `del-${Math.random().toString(36).substr(2,9)}`;
            d.rubric?.forEach((r: any) => {
                if(!r.id) r.id = `crit-${Math.random().toString(36).substr(2,9)}`;
            });
        });
        
        return parsed;
    } catch (e: any) {
        console.error("Failed to parse brief", e?.message || "Unknown error");
        return {};
    }
};

export const generateGradingFeedback = async (
    rubric: RubricCriteria[],
    gradeLevels: Record<string, string>,
    studentName: string,
    numericScores?: Record<string, number>
): Promise<string> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return "Great work!";
    const ai = getAI();

    const performance = rubric
        .filter(r => gradeLevels[r.id])
        .map(r => {
            const grade = gradeLevels[r.id];
            const score = numericScores ? numericScores[r.id] : '';
            const level = r.levels.find(l => l.grade === grade);
            return `- ${r.criteria} (${r.weightage}%): Grade "${grade}" ${score ? `(Score: ${score})` : ''}. Description: ${level?.description || ''}`;
    }).join('\n');

    if (!performance) return "Please select rubric criteria to generate feedback.";

    const prompt = `
    Generate constructive and encouraging feedback for a student named ${studentName} based on the following grading rubric assessment.
    
    Rubric Assessment:
    ${performance}
    
    The feedback should:
    1. Acknowledge what was done well (High scores/Excellent grades).
    2. Suggest specific areas for improvement based on lower grades or lower scores within a range.
    3. Be approximately 50-100 words.
    4. Use a supportive, tutor-like tone.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text || "Feedback generation failed.";
    } catch (e: any) {
        console.error("Gemini Grading Error:", e?.message || "Unknown error");
        return "Good effort on this assignment.";
    }
}

export const generateChunkSmartContent = async (
    activityType: string, 
    description: string, 
    moduleTopic: string,
    duration: number
): Promise<Partial<AIClassModule>> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    const ai = getAI();

    let specificInstructions = "";
    let useSearch = false;
    
    switch (activityType) {
        case 'Lecture':
            specificInstructions = `
            - Generate ~${Math.max(1, Math.ceil(duration/1))} slides (20s each). Last slide Q&A. Focus on ${description}.
            - slideSchema: { id, title, onScreen: { headline, bullets[], summary }, speakerNotes, visualKeyword, durationSeconds, showOnProjector }
            `;
            break;
        case 'Quiz':
            specificInstructions = `
            - Generate a quiz UI object.
            - numQuestions: ~${Math.max(3, Math.ceil(duration/2))} (30s per question).
            - quizSchema: { quizId, numQuestions, durationPerQuestionSeconds, questions: [{ id, question, options[], correctIndex, explanation, exposeToStudent: false }], scoring: { basePointsPerQuestion: 100 }, tutorControls: { startQuiz: true } }
            `;
            break;
        case 'Interaction':
        case 'Group Discussion':
            specificInstructions = `
            - Create 3-4 slides as conversation starters.
            `;
            break;
        case 'Screening':
            useSearch = true;
            specificInstructions = `
            - Perform a Google Search to find 2-3 high-quality YouTube videos related to "${description}".
            - Select videos that fit within a ${duration} minute segment (consider the video duration + discussion).
            - Ensure the videos are educational and relevant to the module topic "${moduleTopic}".
            - CRITICAL: Use the search tool to find REAL videos. Do not hallucinate video IDs.
            - screeningSchema: { title, description, videos: [{ title, url, duration, channel }], discussionPrompt }
            `;
            break;
        default:
            specificInstructions = `Generate slides and notes for: "${description}".`;
    }

    const prompt = `
    Generate classroom-ready content tailored to chunk.activity. Produce JSON matching the schema below.
    
    Caller Context:
    moduleTitle: "${moduleTopic}"
    lessonTopic: "${description}"
    chunk: { activity: "${activityType}", duration: ${duration}, content: "${description}" }
    
    Directives: ${specificInstructions}
    
    IMPORTANT: Output purely valid JSON. For any text content that spans multiple lines, use literal '\\n' characters. Do NOT use actual newlines (line breaks) within string values.
    
    Output JSON Schema:
    {
      "generatedContent": {
        "activity": "${activityType}",
        "estimatedTotalDurationSeconds": ${duration * 60},
        "slides": [ /* array of slideSchema */ ],
        "quiz": { /* quizSchema if Quiz */ },
        "screening": { 
            "title": "Screening Session", 
            "description": "...", 
            "videos": [ { "title": "...", "url": "...", "duration": "...", "channel": "..." } ], 
            "discussionPrompt": "..." 
        },
        "notes": "Detailed study notes for this chunk."
      }
    }
    Return only valid JSON.
    `;

    const config: any = {};
    if (useSearch) {
        config.tools = [{ googleSearch: {} }];
    } else {
        config.responseMimeType = 'application/json';
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: config
    });

    try {
        const raw = JSON.parse(cleanJson(response.text || "{}"));
        const content = raw.generatedContent || {};
        
        const v1Slides = (content.slides || []).map((s: any) => ({
            id: s.id || `s-${Math.random()}`,
            title: s.title || "Untitled Slide",
            bulletPoints: s.onScreen?.bullets || [],
            speakerNotes: s.speakerNotes || "",
            visualKeyword: s.visualKeyword || "abstract"
        }));
        
        const v1Quiz = (content.quiz?.questions || []).map((q: any) => ({
            id: q.id || `q-${Math.random()}`,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex
        }));

        return {
            slides: v1Slides,
            preQuiz: [], 
            postQuiz: v1Quiz,
            notes: content.notes || "",
            generatedContent: content
        };

    } catch (e: any) {
        console.error("Failed to parse smart chunk", e?.message || "Unknown error");
        return {};
    }
};

// Kept for backward compatibility
export const generateSmartClassModule = async (topic: string): Promise<Partial<AIClassModule>> => {
    return generateChunkSmartContent('Lecture', topic, topic, 60);
};

export const regenerateQuiz = async (topic: string, difficulty: QuizDifficulty): Promise<AIQuizQuestion[]> => {
    const ai = getAI();
    let qCount = 5;
    if (difficulty === 'Basic') qCount = 10;
    if (difficulty === 'Tough') qCount = 3;

    const prompt = `
    Create a ${difficulty} difficulty quiz with exactly ${qCount} multiple choice questions on the topic: "${topic}".
    Return valid JSON only. Ensure strings do not contain unescaped line breaks.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    questions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                correctIndex: { type: Type.NUMBER }
                            }
                        }
                    }
                }
            }
        }
    });

    try {
        const data = JSON.parse(cleanJson(response.text || "{}"));
        return data.questions.map((q: any, i: number) => ({ ...q, id: `q-${Date.now()}-${i}` }));
    } catch (e) {
        return [];
    }
};

export const fleshOutSlide = async (title: string, keyword: string): Promise<Partial<AISlide>> => {
     const ai = getAI();
     const prompt = `Flesh out slide "${title}" (context: ${keyword}). Return JSON { bulletPoints: string[], speakerNotes: string }. Ensure valid JSON.`;
     const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' }});
     try { return JSON.parse(cleanJson(response.text || "{}")); } catch { return {}; }
};

export const generateLessonPlan = async (
    topic: string, 
    durationMinutes: number, 
    context?: ModuleContext
): Promise<LessonChunk[]> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    const ai = getAI();

    let strategyInstruction = "";
    if (context) {
        if (context.type === 'Software Training') {
            strategyInstruction = `Focus on practical demonstrations and hands-on practice. Include "Demo" followed by "Class Work" chunks. Reduce generic "Lecture" time.`;
        } else if (context.type === 'Theory') {
            strategyInstruction = `Focus on conceptual clarity using "Lecture" and "Discussion" chunks. Use "Quiz" for comprehension checks.`;
        } else if (context.type === 'Art Workshop') {
            strategyInstruction = `Focus on "Demo" of techniques and long "Class Work" blocks for creation.`;
        } else if (context.type === 'Project') {
            strategyInstruction = `Focus on "Group Discussion" for brainstorming and "Class Work" for execution.`;
        }

        if (context.customPrompt) {
            strategyInstruction += `\nAdditional Instruction from Tutor: "${context.customPrompt}"`;
        }
    }

    const prompt = `
    You are an Instructional Designer. Create a detailed Lesson Plan for the topic: "${topic}".
    Total Duration: ${durationMinutes} minutes.
    
    Module Context: ${context ? context.type : 'General'}
    
    Instructional Design Rules:
    1. Use "Chunking Theory": Break the lesson into segments of 10-15 minutes max.
    2. Use "Cognitive Learning Model": Sequence activities from introduction to interaction to practice.
    3. Mix activity types: Use Lecture, Quiz, Interaction, Demo, Screening, Group Discussion, Class Work, Break.
    4. **Important:** ${strategyInstruction}

    Structure Requirements:
    - Start with a 5-min "Pre-Quiz" or Intro.
    - End with a 5-min "Post-Quiz" or Summary.
    - Insert a 3-min "Break" every ~40-50 mins.

    Return JSON: array of { duration, activity, content, objective }.
    Ensure the JSON is strictly valid and strings are properly escaped.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        duration: { type: Type.NUMBER },
                        activity: { type: Type.STRING, enum: ['Lecture', 'Quiz', 'Interaction', 'Demo', 'Screening', 'Group Discussion', 'Class Work', 'Break'] },
                        content: { type: Type.STRING },
                        objective: { type: Type.STRING }
                    }
                }
            }
        }
    });

    try {
        const data = JSON.parse(cleanJson(response.text || "[]"));
        return data.map((chunk: any, index: number) => ({
            ...chunk,
            id: `chunk-${Date.now()}-${index}`
        }));
    } catch (e: any) {
        console.error("Failed to generate lesson plan", e?.message || "Unknown error");
        return [];
    }
};

export const mapSyllabusToTopics = async (
    syllabusText: string, 
    count: number, 
    context?: ModuleContext
): Promise<string[]> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    const ai = getAI();

    let contextPrompt = "";
    if (context) {
        contextPrompt = `
        Context:
        - Module Type: ${context.type}
        - Taught Hours: ${context.taughtHours}
        - Independent Learning Hours: ${context.gilHours}
        - Special Instructions: ${context.customPrompt}
        `;
    }

    const prompt = `
    You are a senior curriculum planner.
    Analyze the following University Syllabus content.
    Break it down into EXACTLY ${count} distinct, sequential daily class topics.
    
    Rules:
    1. The array MUST contain exactly ${count} strings. 
    2. If the syllabus is short, break big topics into smaller sub-topics (e.g., "Unit 1 Part A", "Unit 1 Part B").
    3. If you run out of content, add "Revision", "Assessment", or "Project Review" sessions to reach the count.
    4. The sum of these sessions should cover the Taught Hours effectively.
    5. If complex topics require more time, split them across multiple sessions (Part 1, Part 2).
    
    ${contextPrompt}
    
    Syllabus Content:
    "${syllabusText.substring(0, 8000)}"
    
    Return a JSON object with a single array 'topics'.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    topics: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            }
        }
    });

    try {
        const topics = JSON.parse(cleanJson(response.text || "{}")).topics || [];
        
        // Manual padding/trimming to ensure robustness
        if (topics.length < count) {
            const missing = count - topics.length;
            for (let i = 0; i < missing; i++) {
                topics.push(`Review & Assessment Session ${i + 1}`);
            }
        } else if (topics.length > count) {
            // If too many, try to keep them or just slice? Slicing might lose data.
            // Usually AI adheres, but if not, we take the first 'count'.
            return topics.slice(0, count);
        }
        
        return topics;
    } catch (e: any) {
        return Array.from({ length: count }, (_, i) => `Topic ${i + 1} (Auto-generated fallback)`);
    }
};

export const enhanceSyllabusContent = async (
    syllabusText: string,
    context?: ModuleContext
): Promise<string> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    const ai = getAI();

    const prompt = `
    You are an Academic Curriculum Specialist for a premier Design & Media College (ICAT).
    Your task is to ENHANCE the provided syllabus content to align with modern industry standards, latest technologies, and creative trends.
    
    Context:
    - Module Type: ${context?.type || 'General'}
    - Goal: Make it practical, cutting-edge, and industry-relevant.
    
    Instructions:
    1. Keep the core topics but expand them with modern sub-topics.
    2. Add "Industry Applications" or "Case Studies" sections where relevant.
    3. Suggest "Latest Tools/Software" if applicable.
    4. Maintain the structure but enrich the content depth.
    
    Original Syllabus:
    "${syllabusText.substring(0, 5000)}"
    
    Return the Enhanced Syllabus as plain text (Markdown friendly).
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    return response.text || syllabusText; // Return original if fails
};

// --- PEER REVIEW AI SERVICES ---

// Service 1: Synthesize Peer Feedback
export const synthesizePeerFeedback = async (
    moduleTitle: string,
    rubric: RubricCriteria[],
    peerReviews: PeerReviewInput[]
): Promise<PeerReviewSynthesisResult | null> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    const ai = getAI();

    // Prepare Review Data for Prompt
    const reviewsText = peerReviews.map((pr, i) => `
        Reviewer ${i+1}:
        Scores: ${JSON.stringify(pr.scores)}
        Feedback: "${pr.feedbackText}"
    `).join('\n\n');

    const rubricText = rubric.map(r => `${r.criteria} (Weight: ${r.weightage}%) - Levels: ${r.levels.map(l => l.grade).join(', ')}`).join('; ');

    const prompt = `
    You are an academic moderator acting as a "Peer Review Synthesizer".
    Analyze the following ${peerReviews.length} peer reviews for a student's submission in the module "${moduleTitle}".
    
    Rubric Structure:
    ${rubricText}
    
    Grading Reference Scale (0-100):
    - Excellent: 90-100
    - Very Good: 75-89
    - Good: 60-74
    - Average: 40-59
    - Poor: 0-39
    
    Peer Reviews Provided:
    ${reviewsText}
    
    Task:
    1. Aggregate the scores for each criteria. Calculate the average.
    2. Analyze the text feedback for consensus (common strengths/weaknesses).
    3. Generate a polished, constructive "Synthesized Feedback" paragraph that the student can use to improve their work. Use professional, educational language.
    
    Return strictly valid JSON matching this schema:
    {
      "consensus_summary": "Brief overview of agreement among reviewers.",
      "average_scores_by_criteria": { "criteriaId": number, ... },
      "synthesized_feedback": "The final polished feedback text..."
    }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    consensus_summary: { type: Type.STRING },
                    average_scores_by_criteria: { 
                        type: Type.OBJECT, 
                        // Note: OpenAPI schema for map/record is tricky in strict mode, 
                        // often represented as additionalProperties. 
                        // For simplicity in GenAI SDK, we can use an object with arbitrary keys if supported, 
                        // or define it generally. Here we assume standard object return.
                    },
                    synthesized_feedback: { type: Type.STRING }
                }
            }
        }
    });

    try {
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e: any) {
        console.error("Failed to synthesize peer feedback", e?.message);
        return null;
    }
};

// Service 2: Assess Review Quality (Gamification)
export const assessReviewQuality = async (
    rubric: RubricCriteria[],
    reviewerScores: Record<string, number>,
    rawFeedbackText: string,
    reviewerId: string
): Promise<PeerReviewQualityResult | null> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    const ai = getAI();

    const rubricContext = rubric.map(r => `${r.criteria}: ${r.levels.map(l => l.grade + " (" + l.description + ")").join(', ')}`).join('\n');

    const prompt = `
    You are a quality assurance system for an academic peer review platform. 
    Evaluate the QUALITY of the peer review provided by Student ${reviewerId}.
    
    Context:
    The student reviewed a peer's work based on this Rubric:
    ${rubricContext}
    
    The Student's Review:
    - Numerical Scores Given: ${JSON.stringify(reviewerScores)}
    - Written Feedback: "${rawFeedbackText}"
    
    Evaluation Criteria for the Reviewer:
    1. Specificity: Did they mention specific parts of the work?
    2. Alignment: Does the written feedback match the scores given? (e.g., High score but negative text is bad alignment).
    3. Constructiveness: Is the tone helpful?
    
    Task:
    Rate the quality of this review to award Gamification Points.
    
    Return strictly valid JSON:
    {
      "review_quality_score": Integer (1-10, where 10 is perfect detailed feedback),
      "feedback_specificity_rating": "High" | "Medium" | "Low",
      "criteria_alignment_notes": "One sentence explaining if their text matches their scores.",
      "summary_for_tutor": "A brief internal note for the tutor about this reviewer's performance."
    }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    review_quality_score: { type: Type.NUMBER },
                    feedback_specificity_rating: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                    criteria_alignment_notes: { type: Type.STRING },
                    summary_for_tutor: { type: Type.STRING }
                }
            }
        }
    });

    try {
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e: any) {
        console.error("Failed to assess review quality", e?.message);
        return null;
    }
};
