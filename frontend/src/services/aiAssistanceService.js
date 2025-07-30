// frontend/src/services/aiAssistanceService.js

const API_BASE_URL = 'http://localhost:8000';

class AIAssistanceService {
    constructor() {
        this.baseURL = `${API_BASE_URL}/ai-assistance`;
    }

    /**
     * Get authentication headers
     */
    getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            ...(token && {'Authorization': `Bearer ${token}`})
        };
    }

    /**
     * Generic AI call without predefined prompts
     */
    async makeGenericAICall({
                                systemPrompt = null,
                                userPrompt = null,
                                messages = null,
                                temperature = null,
                                maxTokens = null,
                                responseFormat = null
                            }) {
        try {
            const response = await fetch(`${this.baseURL}/generic-call`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    system_prompt: systemPrompt,
                    user_prompt: userPrompt,
                    messages,
                    temperature,
                    max_tokens: maxTokens,
                    response_format: responseFormat
                })
            });

            if (!response.ok) {
                throw new Error(`AI call failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Generic AI call error:', error);
            throw error;
        }
    }

    /**
     * Get AI-powered transformation suggestions
     */
    async suggestTransformations({
                                     sourceColumns,
                                     outputSchema,
                                     transformationContext = null
                                 }) {
        try {
            const response = await fetch(`${this.baseURL}/suggest-transformations`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    source_columns: sourceColumns,
                    output_schema: outputSchema,
                    transformation_context: transformationContext
                })
            });

            if (!response.ok) {
                throw new Error(`Transformation suggestion failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Transformation suggestion error:', error);
            throw error;
        }
    }

    /**
     * Analyze data patterns and get insights
     */
    async analyzeDataPatterns(dataStructure) {
        try {
            const response = await fetch(`${this.baseURL}/analyze-data-patterns`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(dataStructure)
            });

            if (!response.ok) {
                throw new Error(`Data pattern analysis failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Data pattern analysis error:', error);
            throw error;
        }
    }

    /**
     * Test AI service connection
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.baseURL}/test-connection`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Connection test failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('AI connection test error:', error);
            throw error;
        }
    }

    /**
     * Get suggestions for row generation rules
     */
    async suggestRowGenerationRules({
                                        sourceColumns,
                                        outputSchema,
                                        existingRules = [],
                                        context = null
                                    }) {
        const systemPrompt = `
You are a data transformation expert. Analyze the source columns and output schema to suggest intelligent row generation rules.

Focus on these patterns:
1. Category/Type columns → Conditional expansion
2. Quantity/Amount columns → Duplication strategies  
3. Address/Location fields → Normalization patterns
4. Tax/Financial data → Line item expansion
5. Country/Region data → Localization expansion

IMPORTANT: Return ONLY a valid JSON object with this exact structure:
{
  "suggestions": [
    {
      "rule_type": "conditional_expansion",
      "title": "Settlement Status Expansion",
      "description": "Create different rows based on settlement status",
      "confidence": 0.8,
      "reasoning": "Found Settlement_Status column - expand for status tracking",
      "auto_config": {
        "name": "Settlement Status Rule",
        "type": "expand",
        "strategy": {
          "type": "conditional_expansion",
          "config": {
            "condition": "Settlement_Status == 'Pending'",
            "true_expansions": [{"set_values": {"status_type": "pending"}}],
            "false_expansions": [{"set_values": {"status_type": "completed"}}]
          }
        }
      }
    }
  ]
}

DO NOT include any text outside the JSON object. Return only valid JSON.
`;

        const userPrompt = `
Analyze this data structure for row generation opportunities:

SOURCE COLUMNS: ${JSON.stringify(sourceColumns)}
OUTPUT SCHEMA: ${JSON.stringify(outputSchema)}
EXISTING RULES: ${JSON.stringify(existingRules)}
CONTEXT: ${JSON.stringify(context)}

Return practical row generation rule suggestions as a JSON object with the exact structure specified in the system prompt.
`;

        return await this.makeGenericAICall({
            systemPrompt,
            userPrompt,
            temperature: 0.3,
            responseFormat: {type: "json_object"}
        });
    }

    /**
     * Get suggestions for column mappings
     */
    async suggestColumnMappings({
                                    sourceColumns,
                                    outputSchema,
                                    existingMappings = [],
                                    context = null
                                }) {
        const systemPrompt = `
You are a data mapping specialist. Analyze source and target columns to suggest intelligent mapping strategies.

Focus on these patterns:
1. Calculation columns (total, sum, net) → Expression mappings
2. ID/Reference columns → Sequential generation
3. Status/Flag columns → Conditional logic
4. Date/Time columns → Format transformations
5. Currency/Amount columns → Financial calculations

IMPORTANT: Return ONLY a valid JSON object with this exact structure:
{
  "suggestions": [
    {
      "target_column": "column_id",
      "mapping_type": "expression",
      "title": "Calculate Total Amount", 
      "description": "Sum base amount and tax",
      "confidence": 0.9,
      "reasoning": "Detected total pattern with component amounts available",
      "auto_config": {
        "mapping_type": "expression",
        "transformation": {
          "type": "expression",
          "config": {
            "formula": "{Net_Amount} + {Tax_Amount}",
            "variables": {
              "Net_Amount": "Net_Amount",
              "Tax_Amount": "Tax_Amount"
            }
          }
        }
      }
    }
  ]
}

DO NOT include any text outside the JSON object. Return only valid JSON.
`;

        const userPrompt = `
Analyze this data structure for column mapping opportunities:

SOURCE COLUMNS: ${JSON.stringify(sourceColumns)}
OUTPUT SCHEMA: ${JSON.stringify(outputSchema)}
EXISTING MAPPINGS: ${JSON.stringify(existingMappings)}
CONTEXT: ${JSON.stringify(context)}

Return practical column mapping suggestions as a JSON object with the exact structure specified in the system prompt.
`;

        return await this.makeGenericAICall({
            systemPrompt,
            userPrompt,
            temperature: 0.3,
            responseFormat: {type: "json_object"}
        });
    }

    /**
     * Get help with specific transformation challenges
     */
    async getTransformationHelp(question, context = {}) {
        const systemPrompt = `
You are a helpful data transformation assistant. Provide clear, actionable advice for data transformation challenges.

Focus on:
- Practical solutions
- Step-by-step guidance  
- Best practices
- Common pitfalls to avoid
- Alternative approaches
`;

        const userPrompt = `
Question: ${question}

Context: ${JSON.stringify(context)}

Please provide helpful guidance for this transformation challenge.
`;

        return await this.makeGenericAICall({
            systemPrompt,
            userPrompt,
            temperature: 0.7
        });
    }

    /**
     * Validate transformation configuration with AI
     */
    async validateTransformationConfig(config) {
        const systemPrompt = `
You are a data transformation validator. Review transformation configurations and identify:
1. Potential errors or conflicts
2. Missing mappings for required fields
3. Performance optimization opportunities
4. Data quality risks
5. Best practice recommendations

Provide constructive feedback in a structured format.
`;

        const userPrompt = `
Please review this transformation configuration:

${JSON.stringify(config, null, 2)}

Identify any issues and provide recommendations for improvement.
`;

        return await this.makeGenericAICall({
            systemPrompt,
            userPrompt,
            temperature: 0.3
        });
    }

    /**
     * Generate sample data for testing transformations
     */
    async generateSampleData({
                                 sourceSchema,
                                 rowCount = 5,
                                 dataPatterns = null
                             }) {
        const systemPrompt = `
You are a test data generator. Create realistic sample data that matches the provided schema and patterns.

Generate data that:
1. Follows the column types and constraints
2. Includes edge cases and variations
3. Represents realistic business scenarios
4. Tests different transformation paths

Return as JSON array of sample rows.
`;

        const userPrompt = `
Generate ${rowCount} sample rows for this schema:

SCHEMA: ${JSON.stringify(sourceSchema)}
PATTERNS: ${JSON.stringify(dataPatterns)}

Create realistic, varied test data that would be useful for transformation testing.
`;

        return await this.makeGenericAICall({
            systemPrompt,
            userPrompt,
            temperature: 0.8,
            responseFormat: {type: "json_object"}
        });
    }

    /**
     * Get AI-powered data quality analysis
     */
    async analyzeDataQuality({
                                 sampleData,
                                 schema,
                                 context = null
                             }) {
        const systemPrompt = `
You are a data quality expert. Analyze sample data and identify:
1. Data quality issues (missing values, inconsistencies, outliers)
2. Format standardization opportunities
3. Data validation requirements
4. Cleansing recommendations
5. Potential data loss risks

Provide actionable insights for data quality improvement.
`;

        const userPrompt = `
Analyze this sample data for quality issues:

SAMPLE DATA: ${JSON.stringify(sampleData)}
SCHEMA: ${JSON.stringify(schema)}
CONTEXT: ${JSON.stringify(context)}

Provide comprehensive data quality analysis and recommendations.
`;

        return await this.makeGenericAICall({
            systemPrompt,
            userPrompt,
            temperature: 0.3
        });
    }

    /**
     * Get optimization suggestions for complex transformations
     */
    async suggestOptimizations({
                                   transformationConfig,
                                   performanceMetrics = null,
                                   context = null
                               }) {
        const systemPrompt = `
You are a performance optimization expert for data transformations. Analyze transformation configurations and suggest optimizations for:
1. Processing speed improvements
2. Memory usage optimization
3. Scalability enhancements
4. Error handling improvements
5. Maintainability suggestions

Focus on practical, implementable optimizations.
`;

        const userPrompt = `
Review this transformation configuration for optimization opportunities:

TRANSFORMATION CONFIG: ${JSON.stringify(transformationConfig)}
PERFORMANCE METRICS: ${JSON.stringify(performanceMetrics)}
CONTEXT: ${JSON.stringify(context)}

Suggest specific optimizations to improve performance and reliability.
`;

        return await this.makeGenericAICall({
            systemPrompt,
            userPrompt,
            temperature: 0.3
        });
    }

    /**
     * Get AI assistance for error resolution
     */
    async getErrorResolution({
                                 errorMessage,
                                 transformationConfig,
                                 context = null
                             }) {
        const systemPrompt = `
You are a debugging expert for data transformations. Help users resolve transformation errors by:
1. Analyzing error messages and context
2. Identifying root causes
3. Providing step-by-step solutions
4. Suggesting preventive measures
5. Offering alternative approaches

Focus on clear, actionable guidance.
`;

        const userPrompt = `
Help resolve this transformation error:

ERROR: ${errorMessage}
TRANSFORMATION CONFIG: ${JSON.stringify(transformationConfig)}
CONTEXT: ${JSON.stringify(context)}

Provide detailed troubleshooting steps and solutions.
`;

        return await this.makeGenericAICall({
            systemPrompt,
            userPrompt,
            temperature: 0.4
        });
    }

    /**
     * Generate documentation for transformations
     */
    async generateDocumentation({
                                    transformationConfig,
                                    includeExamples = true,
                                    format = 'markdown'
                                }) {
        const systemPrompt = `
You are a technical documentation specialist. Generate comprehensive documentation for data transformations including:
1. Transformation overview and purpose
2. Input/output specifications
3. Mapping logic explanations
4. Usage examples
5. Troubleshooting guide

Write clear, professional documentation that helps users understand and maintain the transformation.
`;

        const userPrompt = `
Generate ${format} documentation for this transformation:

TRANSFORMATION CONFIG: ${JSON.stringify(transformationConfig)}
INCLUDE EXAMPLES: ${includeExamples}

Create comprehensive documentation that explains the transformation logic and usage.
`;

        return await this.makeGenericAICall({
            systemPrompt,
            userPrompt,
            temperature: 0.4
        });
    }
}

// Create singleton instance
export const aiAssistanceService = new AIAssistanceService();
export default aiAssistanceService;