#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Force LLM call and log everything - no mock fallback
const forceLLMCall = async () => {
  console.log('🎯 FORCE LLM CALL - TESTING GEMINI 1.5 FLASH DIRECTLY');
  console.log('===========================================');
  console.log('Model: gemini-1.5-flash');
  console.log('API URL:', process.env.GEMINI_API_URL);
  console.log('API Key configured:', process.env.GEMINI_API_KEY ? 'YES' : 'NO');
  console.log('===========================================');

  // Test LLM prompt for trading agent
  const promptData = {
    task: "Generate a Cedar authorization policy based on agent context and requirements",
    context: {
      agent_id: 'test-trading-agent',
      task_description: 'trade',
      authentication_level: 'mfa',
      roles: ['trading-agent', 'portfolio-manager'],
      available_actions: [
        "portfolio_access",
        "quote_tool",
        "trade_using_market_order",
        "call_tool",
        "read_capabilities",
        "manage_workflows",
        "access_sensitive_data",
        "execute_admin_actions",
        "modify_settings"
      ],
      available_resources: [
        "trading/*",
        "portfolio/*",
        "market-data/*",
        "tools/*",
        "workflows/dev",
        "workflows/prod",
        "data/sensitive",
        "data/public",
        "settings/system"
      ]
    },
    requirements: [
      "Generate permit/deny rules based on authentication level",
      "Limit actions based on assigned roles",
      "Restrict sensitive resources to high-trust roles",
      "Use proper Cedar syntax with MCP:: namespaces",
      "Include conditions for task-specific permissions"
    ],
    output_format: {
      policy: "Complete Cedar policy string",
      rationale: "Explain the policy decisions made",
      risk_level: "Assess security implications"
    }
  };

  const systemPrompt = `# Cedar Policy Generator

You are an expert at generating Cedar authorization policies for security systems. Your task is to generate precise, secure Cedar policies based on agent context and requirements.

## Important Cedar Syntax Rules:
- Use: permit(principal, action, resource) or forbid(principal, action, resource)
- Principal types: MCP::Client::"authenticated", MCP::Client::"unauthenticated"
- Action types: MCP::Action::"call_tool", MCP::Action::"read_capabilities", etc.
- Use proper MCP:: namespaces

## Security Guidelines:
- Default deny (fail-safe approach)
- Least privilege principle
- Authentication-based scaling
- Role-appropriate restrictions`;

  const userPrompt = `
Generate a Cedar authorization policy for this agent scenario:

AGENT CONTEXT:
- Agent ID: ${promptData.context.agent_id}
- Task: ${promptData.context.task_description}
- Authentication Level: ${promptData.context.authentication_level}
- Roles: ${promptData.context.roles.join(', ')}
- Available Actions: ${promptData.context.available_actions.join(', ')}
- Available Resources: ${promptData.context.available_resources.join(', ')}

REQUIREMENTS:
${promptData.requirements.map(req => `- ${req}`).join('\n')}

OUTPUT FORMAT:
Return JSON with:
{
  "policy": "complete cedar policy text here",
  "rationale": "explain security decisions made",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "allowed_actions": ["action1", "action2"]
}`;

  console.log('\n📡 MAKING API CALL TO GOOGLE GEMINI API...');

  const requestBody = {
    contents: [{
      parts: [{
        text: systemPrompt + "\n\n" + userPrompt
      }]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2000,
      topK: 1,
      topP: 0.1
    },
    safetySettings: [{
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE"
    }]
  };

  console.log('Request body preview:');
  console.log(JSON.stringify(requestBody, null, 2).slice(0, 500) + '...');

  const startTime = Date.now();

  try {
    const response = await fetch(process.env.GEMINI_API_URL + '?key=' + process.env.GEMINI_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`\n⏱️  API Response Time: ${duration}ms`);
    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('\n❌ API ERROR DETAILS:');
      console.log(errorText);
      return;
    }

    const geminiResult = await response.json();
    console.log('\n✅ RAW API RESPONSE:');
    console.log(JSON.stringify(geminiResult, null, 2));

    // Parse the generated text
    const generatedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      console.log('\n❌ No generated text in response');
      return;
    }

    console.log('\n🤖 GENERATED TEXT:');
    console.log(generatedText);

    // Try to parse as JSON
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(generatedText);
    } catch (parseError) {
      console.log('\n📝 Trying to extract JSON from text...');
      const jsonMatch = generatedText.match(/```json\s*(\{[\s\S]*\})\s*```/) ||
                        generatedText.match(/```([\s\S]*?\})[\s\S]*```/) ||
                        generatedText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        console.log('✅ JSON extracted successfully');
      } else {
        console.log('❌ Could not extract JSON from response');
        return;
      }
    }

    console.log('\n🎯 PARSED POLICY RESPONSE:');
    console.log(JSON.stringify(parsedResponse, null, 2));

    console.log('\n🏁 LLM CALL COMPLETED SUCCESSFULLY');
    console.log('===========================================');

  } catch (error) {
    console.log('\n💥 EXCEPTION DURING API CALL:');
    console.log(error.message);
    console.log('\n🔍 TROUBLESHOOTING STEPS:');
    console.log('1. Check if GEMINI_API_KEY is valid');
    console.log('2. Check if gemini-2.5-pro-latest model exists');
    console.log('3. Check network connectivity to Google APIs');
    console.log('4. Verify API quota/limits');
  }
};

forceLLMCall();
