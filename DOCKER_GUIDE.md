# Docker Deployment Guide

## 🐳 **Container Overview**

Your application is now containerized with separate optimized containers:

- **Backend**: FastAPI on Python 3.11-slim (Production-ready)
- **Frontend**: React served by Nginx Alpine (Lightweight)

## 🚀 **Quick Start**

### **Development Environment**
```bash
# Start both services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Access:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

### **Production Environment**
```bash
# Set environment variables
export SERVER_URL=https://your-api-domain.com
export OPENAI_API_KEY=sk-your-key
export ALLOWED_ORIGINS=https://your-frontend-domain.com
export SECRET_KEY=$(openssl rand -hex 32)

# Start production stack
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 **Building Images**

### **Build Individual Images**
```bash
# Backend
docker build -t ftt-ml/backend:latest ./backend

# Frontend  
docker build -t ftt-ml/frontend:latest ./frontend
```

### **Build with Tags**
```bash
# Version tagged builds
docker build -t ftt-ml/backend:v1.0.0 ./backend
docker build -t ftt-ml/frontend:v1.0.0 ./frontend
```

## 📊 **Container Specifications**

### **Backend Container**
- **Base**: python:3.11-slim
- **Port**: 8000
- **Resources**: 8-14 CPU, 16-28GB RAM
- **Health Check**: GET /health
- **User**: Non-root (appuser)
- **Features**: 
  - Multi-core reconciliation processing
  - File upload handling
  - OpenAI integration
  - Hardware-aware threading

### **Frontend Container**
- **Base**: nginx:alpine (Multi-stage build)
- **Port**: 3000
- **Resources**: 0.5-1 CPU, 512MB-1GB RAM
- **Health Check**: GET /health
- **User**: Non-root (nginx)
- **Features**:
  - Gzip compression
  - SPA routing support
  - Static asset caching
  - Security headers

## 🌍 **Environment Variables**

### **Backend Configuration**
```bash
# Core
ENVIRONMENT=production
HOST=0.0.0.0
PORT=8000
SERVER_URL=https://your-api-domain.com
SECRET_KEY=your-secret-key

# OpenAI
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4-turbo

# Security
ALLOWED_ORIGINS=https://your-frontend.com
DEBUG=false

# Performance  
FTT_ML_CORES=14
BATCH_SIZE=100
LOG_LEVEL=info
```

### **Frontend Configuration**
```bash
REACT_APP_API_URL=https://your-api-domain.com
NODE_ENV=production
```

## 🔍 **Health Checks**

### **Check Container Health**
```bash
# Backend health
curl http://localhost:8000/health

# Frontend health
curl http://localhost:3000/health

# Docker health status
docker ps
```

### **Expected Responses**
```json
// Backend /health
{
  "status": "healthy",
  "timestamp": "2025-01-14T12:00:00.000000",
  "version": "2.0.0",
  "llm_configured": true
}

// Frontend /health  
healthy
```

## 📈 **Performance Optimization**

### **Backend Scaling**
```bash
# For c5.4xlarge (16 vCPU, 32GB)
docker run -d \
  --cpus="14" \
  --memory="28g" \
  -e FTT_ML_CORES=14 \
  -e MEMORY_LIMIT_GB=28 \
  ftt-ml/backend:latest
```

### **Frontend Scaling**
```bash
# Lightweight frontend scaling
docker run -d \
  --cpus="0.5" \
  --memory="512m" \
  ftt-ml/frontend:latest
```

## 🐙 **Multi-Container Orchestration**

### **Docker Compose Commands**
```bash
# Development
docker-compose up -d                    # Start all services
docker-compose up backend               # Start only backend
docker-compose logs backend -f          # Follow backend logs
docker-compose exec backend bash        # Shell into backend
docker-compose down -v                  # Stop and remove volumes

# Production
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml scale backend=2
docker-compose -f docker-compose.prod.yml scale frontend=3
```

### **Network Communication**
```bash
# Services communicate via network
Backend URL from frontend: http://backend:8000
Frontend URL from backend: http://frontend:3000
```

## 🔒 **Security Features**

### **Container Security**
- ✅ Non-root users in both containers
- ✅ Minimal attack surface (slim/alpine images)
- ✅ No unnecessary packages
- ✅ Security headers in nginx
- ✅ Hidden nginx version

### **Application Security**
- ✅ CORS properly configured
- ✅ Debug mode disabled in production
- ✅ Secrets via environment variables
- ✅ Health check endpoints

## 🐛 **Troubleshooting**

### **Common Issues**

1. **Backend Won't Start**
   ```bash
   # Check logs
   docker-compose logs backend
   
   # Common fixes
   # - Verify OPENAI_API_KEY is set
   # - Check ALLOWED_ORIGINS format
   # - Ensure temp directory permissions
   ```

2. **Frontend Can't Reach Backend**
   ```bash
   # Check network connectivity
   docker-compose exec frontend ping backend
   
   # Verify environment
   docker-compose exec frontend env | grep REACT_APP_API_URL
   ```

3. **CORS Errors**
   ```bash
   # Check backend CORS config
   curl -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: POST" \
        -X OPTIONS http://localhost:8000/health
   ```

### **Debug Commands**
```bash
# Container stats
docker stats

# Container processes
docker-compose top

# Network inspection
docker network ls
docker network inspect ftt-ml_ftt-ml-network

# Volume inspection
docker volume ls
docker volume inspect ftt-ml_backend-temp
```

## 🚢 **Deployment to Production**

### **ECS Deployment**
1. **Push images to ECR**
2. **Create ECS task definitions**
3. **Configure services with environment variables**
4. **Setup Application Load Balancer**

### **Manual Docker Deployment**
```bash
# On production server
git clone your-repo
cd ftt-ml

# Set production environment
export ENVIRONMENT=production
export SERVER_URL=https://your-domain.com
# ... other env vars

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Monitor
docker-compose -f docker-compose.prod.yml logs -f
```

## 📊 **Resource Requirements**

| Service | CPU | Memory | Storage | Use Case |
|---------|-----|--------|---------|----------|
| Backend | 8-16 vCPU | 16-32GB | 10GB | Financial processing |
| Frontend | 0.5-1 vCPU | 512MB-1GB | 100MB | Static file serving |
| **Total** | **8.5-17** | **16.5-33GB** | **10.1GB** | **Full stack** |

Your containers are production-ready and optimized for your financial data processing workload! 🚀