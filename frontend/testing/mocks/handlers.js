import { http, HttpResponse } from 'msw'

// Mock API responses for backend endpoints
export const handlers = [
  // Health check endpoint
  http.get('http://localhost:8000/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      llm_configured: true,
      llm_provider: 'openai',
      multi_column_support: true,
      batch_processing_enabled: true,
      current_batch_size: 20,
      uploaded_files_count: 0,
      extractions_count: 0
    })
  }),

  // File upload endpoint
  http.post('http://localhost:8000/upload', async ({ request }) => {
    const formData = await request.formData()
    const file = formData.get('file')
    const label = formData.get('label')
    
    return HttpResponse.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        file_id: 'mock_file_123',
        filename: file.name,
        label: label || 'Test File',
        size: file.size,
        columns: ['id', 'amount', 'date', 'description'],
        totalRows: 100,
        upload_timestamp: new Date().toISOString()
      }
    })
  }),

  // File info endpoint
  http.get('http://localhost:8000/files/:fileId/info', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        file_id: params.fileId,
        filename: 'test_file.csv',
        columns: ['id', 'amount', 'date', 'description'],
        totalRows: 100,
        size: 5024,
        upload_timestamp: new Date().toISOString()
      }
    })
  }),

  // Reconciliation AI configuration
  http.post('http://localhost:8000/reconciliation/ai-generate-config', async ({ request }) => {
    const body = await request.json()
    
    return HttpResponse.json({
      success: true,
      message: 'AI configuration generated successfully',
      data: {
        matching_rules: [
          {
            type: 'exact',
            source_column: 'reference_no',
            target_column: 'ref_number',
            weight: 1.0
          },
          {
            type: 'tolerance',
            source_column: 'amount',
            target_column: 'total_amount',
            tolerance: 0.01,
            weight: 0.8
          }
        ],
        confidence: 0.92,
        explanation: 'Generated matching rules based on natural language requirements'
      }
    })
  }),

  // Reconciliation execution
  http.post('http://localhost:8000/reconciliation/execute', async ({ request }) => {
    const body = await request.json()
    
    return HttpResponse.json({
      success: true,
      message: 'Reconciliation completed successfully',
      data: {
        reconciliation_id: 'recon_123',
        total_source_records: 100,
        total_target_records: 95,
        matched_records: 85,
        unmatched_source: 15,
        unmatched_target: 10,
        processing_time: 2.5,
        match_rate: 0.85
      }
    })
  }),

  // Transformation AI configuration
  http.post('http://localhost:8000/transformation/ai-generate-config', async ({ request }) => {
    const body = await request.json()
    
    return HttpResponse.json({
      success: true,
      message: 'Transformation configuration generated successfully',
      data: {
        transformations: [
          {
            target_column: 'full_name',
            type: 'expression',
            formula: '{first_name} + " " + {last_name}'
          },
          {
            target_column: 'total_amount',
            type: 'expression', 
            formula: '{quantity} * {unit_price}'
          }
        ],
        confidence: 0.88,
        explanation: 'Generated transformation rules from natural language'
      }
    })
  }),

  // Delta generation
  http.post('http://localhost:8000/delta/generate', async ({ request }) => {
    const body = await request.json()
    
    return HttpResponse.json({
      success: true,
      message: 'Delta generation completed successfully',
      data: {
        delta_id: 'delta_123',
        summary: {
          total_old_records: 1000,
          total_new_records: 1050,
          unchanged_records: 915,
          modified_records: 25,
          new_records: 50,
          deleted_records: 10
        },
        processing_time: 3.2
      }
    })
  }),

  // Error handling - return 500 for specific test scenarios
  http.post('http://localhost:8000/test/error', () => {
    return HttpResponse.json(
      { success: false, message: 'Test error for error handling' },
      { status: 500 }
    )
  }),
]