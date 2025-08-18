# Jenkins CI/CD Setup for Multi-Container Application

## 🏗️ **Pipeline Strategies**

You have **3 Jenkins pipeline options** for your 2-container setup:

### **Option 1: Single Pipeline (Recommended) 🎯**
- **File**: `Jenkinsfile`
- **Benefits**: Simple, coordinated deployments, single status
- **Use Case**: Monorepo with tightly coupled frontend/backend

### **Option 2: Separate Pipelines**
- **Files**: `Jenkinsfile.backend`, `Jenkinsfile.frontend`
- **Benefits**: Independent deployments, team separation
- **Use Case**: Different teams, different release cycles

### **Option 3: Smart Conditional Pipeline**
- **File**: `Jenkinsfile.smart`
- **Benefits**: Only builds/deploys changed components
- **Use Case**: Large monorepo, optimization for fast builds

## 🚀 **How Jenkins Handles 2 Docker Files**

### **Build Process**
```groovy
// Jenkins builds each container independently
stage('Build Images') {
    parallel {
        stage('Build Backend') {
            steps {
                sh "cd backend && docker build -t backend:${BUILD_NUMBER} ."
            }
        }
        stage('Build Frontend') {
            steps {
                sh "cd frontend && docker build -t frontend:${BUILD_NUMBER} ."
            }
        }
    }
}
```

### **Directory Structure Jenkins Sees**
```
/var/lib/jenkins/workspace/ftt-ml-pipeline/
├── backend/
│   ├── Dockerfile        ← Jenkins builds this
│   ├── app/
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile        ← Jenkins builds this
│   ├── src/
│   └── package.json
├── Jenkinsfile           ← Jenkins reads this
└── docker-compose.yml
```

## ⚙️ **Jenkins Job Configuration**

### **1. Create Multibranch Pipeline**
```groovy
// In Jenkins UI:
New Item → Multibranch Pipeline → "FTT-ML-Pipeline"

Branch Sources:
- Git: https://your-repo.git
- Credentials: your-git-credentials
- Behaviors: Discover branches

Build Configuration:
- Mode: by Jenkinsfile
- Script Path: Jenkinsfile  // or Jenkinsfile.smart
```

### **2. Environment Variables**
```groovy
// Configure in Jenkins → Manage → System Configuration
DOCKER_REGISTRY = 'your-ecr-registry.amazonaws.com'
AWS_DEFAULT_REGION = 'us-east-1'
ECS_CLUSTER = 'ftt-ml-cluster'

// Credentials (stored securely)
AWS_ACCESS_KEY_ID = 'your-key'
AWS_SECRET_ACCESS_KEY = 'your-secret'
OPENAI_API_KEY = 'sk-your-key'
```

### **3. Required Jenkins Plugins**
```bash
# Install via Jenkins Plugin Manager
- Docker Pipeline
- AWS Steps
- Blue Ocean (optional, for better UI)
- Pipeline: Stage View
- Git Plugin
- Credentials Plugin
```

## 🔄 **Pipeline Workflow Examples**

### **Scenario 1: Backend-Only Change**
```bash
# Developer commits to backend/
git add backend/app/main.py
git commit -m "Fix reconciliation bug"
git push origin feature/fix-recon

# Jenkins Pipeline Result:
✅ Build Backend (5 min)
⏭️ Skip Frontend (no changes)
✅ Test Backend
✅ Deploy Backend Only
```

### **Scenario 2: Frontend-Only Change**
```bash
# Developer commits to frontend/
git add frontend/src/components/
git commit -m "Update UI design"
git push origin feature/new-ui

# Jenkins Pipeline Result:
⏭️ Skip Backend (no changes)
✅ Build Frontend (3 min)
✅ Test Frontend  
✅ Deploy Frontend Only
```

### **Scenario 3: Full Stack Change**
```bash
# Developer commits to both
git add backend/ frontend/
git commit -m "Add new reconciliation feature"
git push origin feature/new-feature

# Jenkins Pipeline Result:
✅ Build Backend (5 min)
✅ Build Frontend (3 min)  ← Parallel
✅ Test Both
✅ Deploy Both Simultaneously
```

## 🐳 **Docker Registry Flow**

### **Image Tagging Strategy**
```bash
# Jenkins creates these tags:
your-ecr-registry.amazonaws.com/ftt-ml-backend:123-abc123
your-ecr-registry.amazonaws.com/ftt-ml-backend:latest

your-ecr-registry.amazonaws.com/ftt-ml-frontend:123-abc123
your-ecr-registry.amazonaws.com/ftt-ml-frontend:latest

# Where:
# 123 = BUILD_NUMBER
# abc123 = GIT_COMMIT_SHORT
```

### **ECS Task Definition Updates**
```json
// Jenkins automatically updates task definitions
{
  "family": "ftt-ml-backend",
  "containerDefinitions": [{
    "image": "your-ecr-registry.amazonaws.com/ftt-ml-backend:123-abc123",
    "name": "backend"
  }]
}
```

## 📊 **Performance Optimization**

### **Parallel Builds**
```groovy
// Both containers build simultaneously
parallel {
    stage('Build Backend') { ... }    // 5 minutes
    stage('Build Frontend') { ... }   // 3 minutes
}
// Total: 5 minutes (not 8 minutes!)
```

### **Layer Caching**
```dockerfile
# Backend Dockerfile optimized for Jenkins
COPY requirements.txt .
RUN pip install -r requirements.txt  ← Cached layer
COPY . .                             ← Only this rebuilds
```

### **Multi-Stage Builds**
```dockerfile
# Frontend Dockerfile uses multi-stage
FROM node:18-alpine AS builder         ← Build stage
FROM nginx:alpine                      ← Production stage
# Jenkins only pushes final small image
```

## 🛠️ **Jenkins Agent Requirements**

### **For Your Jenkins Agent**
```bash
# Required on Jenkins build agent:
- Docker Engine (for building images)
- AWS CLI (for ECR push/ECS deploy)
- curl (for health checks)
- git (for source control)

# Recommended specs:
- 4+ vCPU (for parallel builds)
- 8+ GB RAM (for Docker builds)
- 50+ GB storage (for Docker images)
```

### **Docker-in-Docker Setup**
```groovy
// If using Docker agent
agent {
    docker {
        image 'docker:latest'
        args '-v /var/run/docker.sock:/var/run/docker.sock'
    }
}
```

## 🔍 **Monitoring & Debugging**

### **Build Logs Structure**
```bash
Jenkins Pipeline Log:
├── 📁 Checkout
├── 📁 Build Images
│   ├── 🏗️ Build Backend (logs here)
│   └── 🏗️ Build Frontend (logs here)
├── 📁 Test Images
│   ├── 🧪 Test Backend (health check logs)
│   └── 🧪 Test Frontend (health check logs)
├── 📁 Push Images (ECR push logs)
└── 📁 Deploy (ECS deployment logs)
```

### **Common Issues & Solutions**

1. **Build Fails on One Container**
   ```groovy
   // Pipeline fails fast, doesn't deploy either
   // Fix: Ensure both Dockerfiles are valid
   ```

2. **Docker Layer Cache Miss**
   ```bash
   # Add to Jenkins agent setup:
   export DOCKER_BUILDKIT=1
   ```

3. **ECS Deployment Timeout**
   ```groovy
   // Increase timeout in Jenkins
   timeout(time: 15, unit: 'MINUTES') {
       sh 'aws ecs wait services-stable ...'
   }
   ```

## 🎯 **Recommendation**

**Use the Single Pipeline (`Jenkinsfile`)** because:
- ✅ Your frontend/backend are tightly coupled
- ✅ Simpler to manage and debug
- ✅ Coordinated deployments
- ✅ Single status dashboard
- ✅ Parallel builds still give speed benefits

**Upgrade to Smart Pipeline later** if you need:
- 📈 Faster builds (only changed components)
- 🎛️ More granular control
- 📊 Advanced change detection

Your Jenkins pipeline will efficiently handle both Docker files and deploy them independently to ECS! 🚀