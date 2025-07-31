import { describe, it, expect, beforeEach } from 'vitest'
import { server } from '../mocks/server.js'
import { http, HttpResponse } from 'msw'

// Import your API services
import { reconciliationApi } from '../../src/services/transformationApiService.js'
import { fileManagementService } from '../../src/services/fileManagementService.js'
import { aiAssistanceService } from '../../src/services/aiAssistanceService.js'

describe('API Integration Tests', () => {
  describe('File Management API', () => {
    it('should upload file successfully', async () => {
      const mockFile = new File(['test,data\n1,2'], 'test.csv', { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', mockFile)
      formData.append('label', 'Test File')

      const result = await fileManagementService.uploadFile(formData)

      expect(result.success).toBe(true)
      expect(result.data.filename).toBe('test.csv')
      expect(result.data.file_id).toBe('mock_file_123')
      expect(result.data.columns).toEqual(['id', 'amount', 'date', 'description'])
    })

    it('should get file info', async () => {
      const fileId = 'test_file_123'
      const result = await fileManagementService.getFileInfo(fileId)

      expect(result.success).toBe(true)
      expect(result.data.file_id).toBe(fileId)
      expect(result.data.columns).toBeDefined()
      expect(result.data.totalRows).toBe(100)
    })

    it('should handle file upload errors', async () => {
      // Mock server error
      server.use(
        http.post('http://localhost:8000/upload', () => {
          return HttpResponse.json(
            { success: false, message: 'Upload failed' },
            { status: 500 }
          )
        })
      )

      const mockFile = new File(['invalid'], 'test.csv', { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', mockFile)

      await expect(fileManagementService.uploadFile(formData)).rejects.toThrow()
    })
  })

  describe('Reconciliation API', () => {
    it('should generate AI configuration', async () => {
      const requirements = 'Match by reference number and amount within $0.01'
      const sourceFiles = [
        { filename: 'file_a.csv', columns: ['ref_no', 'amount'] },
        { filename: 'file_b.csv', columns: ['reference', 'total'] }
      ]

      const result = await reconciliationApi.generateAIConfig({
        requirements,
        source_files: sourceFiles
      })

      expect(result.success).toBe(true)
      expect(result.data.matching_rules).toBeDefined()
      expect(result.data.confidence).toBeGreaterThan(0.8)
      expect(result.data.matching_rules).toHaveLength(2)
    })

    it('should execute reconciliation', async () => {
      const config = {
        file_a_id: 'file_123',
        file_b_id: 'file_456',
        matching_rules: [
          { type: 'exact', source_column: 'ref_no', target_column: 'reference' }
        ]
      }

      const result = await reconciliationApi.executeReconciliation(config)

      expect(result.success).toBe(true)
      expect(result.data.reconciliation_id).toBeDefined()
      expect(result.data.matched_records).toBe(85)
      expect(result.data.match_rate).toBe(0.85)
    })

    it('should handle reconciliation API errors', async () => {
      server.use(
        http.post('http://localhost:8000/reconciliation/execute', () => {
          return HttpResponse.json(
            { success: false, message: 'Reconciliation failed' },
            { status: 400 }
          )
        })
      )

      const config = { file_a_id: 'invalid', file_b_id: 'invalid' }
      await expect(reconciliationApi.executeReconciliation(config)).rejects.toThrow()
    })
  })

  describe('AI Assistance API', () => {
    it('should make generic AI calls', async () => {
      const prompt = {
        system_prompt: 'You are a data expert',
        user_prompt: 'Analyze this data pattern',
        temperature: 0.3
      }

      // Mock AI response
      server.use(
        http.post('http://localhost:8000/ai-assistance/generic-call', () => {
          return HttpResponse.json({
            success: true,
            content: 'Based on the data pattern, I recommend...',
            processing_time: 2.5,
            model_used: 'openai'
          })
        })
      )

      const result = await aiAssistanceService.genericCall(prompt)

      expect(result.success).toBe(true)
      expect(result.content).toContain('recommend')
      expect(result.processing_time).toBeDefined()
    })

    it('should handle AI service timeouts', async () => {
      server.use(
        http.post('http://localhost:8000/ai-assistance/generic-call', async () => {
          // Simulate timeout
          await new Promise(resolve => setTimeout(resolve, 1000))
          return HttpResponse.json(
            { success: false, message: 'Request timeout' },
            { status: 504 }
          )
        })
      )

      const prompt = { user_prompt: 'Test prompt' }
      await expect(aiAssistanceService.genericCall(prompt)).rejects.toThrow()
    })
  })

  describe('Health Check API', () => {
    it('should check system health', async () => {
      const response = await fetch('http://localhost:8000/health')
      const health = await response.json()

      expect(health.status).toBe('healthy')
      expect(health.version).toBe('2.0.0')
      expect(health.llm_configured).toBe(true)
      expect(health.multi_column_support).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      // Mock network failure
      server.use(
        http.get('http://localhost:8000/health', () => {
          return HttpResponse.error()
        })
      )

      await expect(fetch('http://localhost:8000/health')).rejects.toThrow()
    })

    it('should handle malformed responses', async () => {
      server.use(
        http.get('http://localhost:8000/health', () => {
          return new HttpResponse('invalid json', {
            headers: { 'Content-Type': 'application/json' }
          })
        })
      )

      const response = await fetch('http://localhost:8000/health')
      await expect(response.json()).rejects.toThrow()
    })
  })
})