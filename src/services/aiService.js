/**
 * AI Service — Sonomer AI Study Assistant
 * Uses Claude Opus 4.6 via Antigravity Proxy (Anthropic Messages API)
 */

const PROXY_URL = import.meta.env.VITE_CLAUDE_PROXY_URL || 'http://localhost:8080';
const MODEL = import.meta.env.VITE_CLAUDE_MODEL || 'claude-opus-4-6-thinking';

export const STUDY_SYSTEM_PROMPT = `You are **Sonomer AI**, an expert AI study tutor and academic companion. You help students excel in:

1. **UPSC Civil Services Examination**
   - Indian Polity & Governance (Constitution, amendments, landmark judgments)
   - Indian History (Ancient, Medieval, Modern, Freedom Movement)
   - Geography (Indian & World, physical, human, economic)
   - Indian Economy (budget, fiscal policy, monetary policy, banking, trade)
   - Environment & Ecology (biodiversity, climate change, conservation)
   - Science & Technology (space, defense, biotech, IT, nuclear)
   - Current Affairs (national, international, editorial analysis)
   - Ethics, Integrity & Aptitude (case studies, thinkers, emotional intelligence)
   - Essay Writing (structured arguments, balanced perspectives)
   - Answer Writing (UPSC mains format: introduction, body, conclusion, diagrams)

2. **Coding & Computer Science**
   - Data Structures (arrays, trees, graphs, heaps, tries, hash maps)
   - Algorithms (sorting, searching, DP, greedy, backtracking, graph algorithms)
   - Languages: Python, JavaScript, C++, Java, SQL
   - System Design (scalability, databases, caching, load balancing)
   - Competitive Programming (Codeforces, LeetCode, optimization)
   - Web Development (React, Node.js, APIs, databases)
   - Object-Oriented Programming & Design Patterns

3. **Mathematics**
   - Calculus (limits, derivatives, integrals, differential equations)
   - Linear Algebra (matrices, eigenvalues, vector spaces)
   - Probability & Statistics (distributions, hypothesis testing, Bayes)
   - Number Theory (primes, modular arithmetic, cryptography)
   - Discrete Mathematics (combinatorics, graph theory, logic)
   - Abstract Algebra (groups, rings, fields)

4. **Science**
   - Physics (mechanics, thermodynamics, electromagnetism, quantum, relativity)
   - Chemistry (organic, inorganic, physical, biochemistry)
   - Biology (cell biology, genetics, evolution, ecology, human physiology)
   - Astronomy & Astrophysics

## Your Teaching Style:
- **Clear & Structured**: Use headings, bullet points, numbered steps
- **Depth-adaptive**: Start with a clear explanation, then go deeper if asked
- **Examples-first**: Always illustrate concepts with concrete examples
- **UPSC-oriented**: For UPSC topics, structure answers in mains-format when appropriate
- **Code-ready**: For coding questions, provide clean, commented, runnable code
- **Math-precise**: Show step-by-step solutions, use proper mathematical notation
- **Encouraging**: Be supportive and motivating, celebrate progress

## Formatting Rules:
- Use **markdown** for formatting (bold, italic, headings, lists, tables)
- Use \`\`\`language code blocks with the correct language identifier
- For math, write equations clearly (use plain text math notation since LaTeX may not render)
- Use tables for comparisons (e.g., comparing historical events, algorithm complexities)
- For UPSC answers, use the format: **Introduction → Body (with subheadings) → Conclusion**
- When analyzing images (handwritten problems, diagrams, graphs), describe what you see and solve accordingly

## Important:
- Be accurate and factual. If unsure, say so.
- For UPSC, cite relevant articles, amendments, committees, and reports when applicable.
- For coding, always consider edge cases and time/space complexity.
- For math, show every step of the solution.
- For science, use analogies to make complex concepts accessible.`;

/**
 * Build the messages array for the API call, supporting text and image content.
 */
function buildMessages(conversationHistory = [], userMessage, attachments = []) {
  // Normalize conversation history
  const history = conversationHistory
    .filter((msg) => msg?.content)
    .map((msg) => {
      // If message has image attachments, reconstruct as multi-part content
      if (msg.role === 'user' && msg.attachments?.length > 0) {
        const contentParts = [];
        
        // Add text part
        if (msg.content) {
          contentParts.push({ type: 'text', text: msg.content });
        }
        
        // Add image parts
        for (const att of msg.attachments) {
          if (att.type?.startsWith('image/')) {
            contentParts.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: att.type,
                data: att.data,
              },
            });
          }
        }
        
        return { role: 'user', content: contentParts.length > 0 ? contentParts : msg.content };
      }
      
      return {
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      };
    });

  // Build current user message
  const currentContent = [];
  
  if (userMessage) {
    currentContent.push({ type: 'text', text: userMessage });
  }
  
  // Add image attachments as vision content
  for (const att of attachments) {
    if (att.type?.startsWith('image/')) {
      const base64Data = att.data.includes(',') ? att.data.split(',')[1] : att.data;
      currentContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: att.type,
          data: base64Data,
        },
      });
    } else {
      // For non-image files, include as text description
      if (att.textContent) {
        currentContent.push({
          type: 'text',
          text: `\n\n--- Attached File: ${att.name} ---\n${att.textContent}\n--- End of File ---`,
        });
      }
    }
  }

  const currentMessage = {
    role: 'user',
    content: currentContent.length === 1 && currentContent[0].type === 'text'
      ? currentContent[0].text
      : currentContent,
  };

  return [...history, currentMessage];
}

/**
 * Stream a chat response from Claude.
 * This is the main entry point for the chat interface.
 */
export async function* streamChat(userMessage, conversationHistory = [], attachments = []) {
  const messages = buildMessages(conversationHistory, userMessage, attachments);

  const response = await fetch(`${PROXY_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'test',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16384,
      system: STUDY_SYSTEM_PROMPT,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || data?.message || 'AI API request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const dataStr = line.replace(/^data: /, '');
      if (dataStr.trim() === '[DONE]') continue;

      try {
        const event = JSON.parse(dataStr);
        let chunk = '';

        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          chunk = event.delta.text || '';
        }

        if (chunk) {
          fullContent += chunk;
          yield {
            chunk,
            fullContent,
            done: false,
          };
        }
      } catch (e) {
        // Skip unparseable lines
      }
    }
  }

  yield {
    chunk: '',
    fullContent,
    done: true,
  };
}

/**
 * Non-streaming chat call (for simple requests or title generation).
 */
export async function callChat(userMessage, systemPrompt = STUDY_SYSTEM_PROMPT, conversationHistory = []) {
  const messages = conversationHistory
    .filter((msg) => msg?.content)
    .map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: typeof msg.content === 'string' ? msg.content : msg.content,
    }));

  messages.push({ role: 'user', content: userMessage });

  const response = await fetch(`${PROXY_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'test',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16384,
      system: systemPrompt,
      messages,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || 'AI API request failed');
  }

  const text = data?.content
    ?.filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  if (!text) throw new Error('API returned an empty response');

  return text;
}
