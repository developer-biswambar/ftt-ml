pipeline {
    agent any
    
    environment {
        // Docker Registry
        DOCKER_REGISTRY = 'your-ecr-registry.amazonaws.com'
        IMAGE_TAG = "${BUILD_NUMBER}"
        
        // Application
        APP_NAME = 'ftt-ml'
        
        // AWS
        AWS_DEFAULT_REGION = 'us-east-1'
        ECS_CLUSTER = 'ftt-ml-cluster'
        ECS_SERVICE_BACKEND = 'ftt-ml-backend-service'
        ECS_SERVICE_FRONTEND = 'ftt-ml-frontend-service'
        
        // Environment-specific
        ENVIRONMENT = 'production'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Get commit info for tagging
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    env.FULL_IMAGE_TAG = "${IMAGE_TAG}-${GIT_COMMIT_SHORT}"
                }
            }
        }
        
        stage('Build Images') {
            parallel {
                stage('Build Backend') {
                    steps {
                        script {
                            echo "🏗️ Building Backend Docker Image..."
                            sh """
                                cd backend
                                docker build \
                                    -t ${DOCKER_REGISTRY}/${APP_NAME}-backend:${FULL_IMAGE_TAG} \
                                    -t ${DOCKER_REGISTRY}/${APP_NAME}-backend:latest \
                                    .
                            """
                        }
                    }
                }
                
                stage('Build Frontend') {
                    steps {
                        script {
                            echo "🏗️ Building Frontend Docker Image..."
                            sh """
                                cd frontend
                                docker build \
                                    -t ${DOCKER_REGISTRY}/${APP_NAME}-frontend:${FULL_IMAGE_TAG} \
                                    -t ${DOCKER_REGISTRY}/${APP_NAME}-frontend:latest \
                                    .
                            """
                        }
                    }
                }
            }
        }
        
        stage('Test Images') {
            parallel {
                stage('Test Backend') {
                    steps {
                        script {
                            echo "🧪 Testing Backend Container..."
                            sh """
                                # Start container for testing
                                docker run -d --name test-backend-${BUILD_NUMBER} \
                                    -p 8001:8000 \
                                    -e ENVIRONMENT=test \
                                    -e DEBUG=false \
                                    -e OPENAI_API_KEY=test-key \
                                    ${DOCKER_REGISTRY}/${APP_NAME}-backend:${FULL_IMAGE_TAG}
                                
                                # Wait for container to start
                                sleep 30
                                
                                # Health check
                                curl -f http://localhost:8001/health || exit 1
                                
                                # Cleanup
                                docker stop test-backend-${BUILD_NUMBER}
                                docker rm test-backend-${BUILD_NUMBER}
                            """
                        }
                    }
                }
                
                stage('Test Frontend') {
                    steps {
                        script {
                            echo "🧪 Testing Frontend Container..."
                            sh """
                                # Start container for testing
                                docker run -d --name test-frontend-${BUILD_NUMBER} \
                                    -p 3001:3000 \
                                    ${DOCKER_REGISTRY}/${APP_NAME}-frontend:${FULL_IMAGE_TAG}
                                
                                # Wait for container to start
                                sleep 15
                                
                                # Health check
                                curl -f http://localhost:3001/health || exit 1
                                
                                # Cleanup
                                docker stop test-frontend-${BUILD_NUMBER}
                                docker rm test-frontend-${BUILD_NUMBER}
                            """
                        }
                    }
                }
            }
        }
        
        stage('Push Images') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'develop'
                }
            }
            parallel {
                stage('Push Backend') {
                    steps {
                        script {
                            echo "📤 Pushing Backend Image to Registry..."
                            sh """
                                aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | \
                                docker login --username AWS --password-stdin ${DOCKER_REGISTRY}
                                
                                docker push ${DOCKER_REGISTRY}/${APP_NAME}-backend:${FULL_IMAGE_TAG}
                                docker push ${DOCKER_REGISTRY}/${APP_NAME}-backend:latest
                            """
                        }
                    }
                }
                
                stage('Push Frontend') {
                    steps {
                        script {
                            echo "📤 Pushing Frontend Image to Registry..."
                            sh """
                                aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | \
                                docker login --username AWS --password-stdin ${DOCKER_REGISTRY}
                                
                                docker push ${DOCKER_REGISTRY}/${APP_NAME}-frontend:${FULL_IMAGE_TAG}
                                docker push ${DOCKER_REGISTRY}/${APP_NAME}-frontend:latest
                            """
                        }
                    }
                }
            }
        }
        
        stage('Deploy to ECS') {
            when {
                branch 'main'
            }
            parallel {
                stage('Deploy Backend') {
                    steps {
                        script {
                            echo "🚀 Deploying Backend to ECS..."
                            sh """
                                # Update ECS service with new image
                                aws ecs update-service \
                                    --cluster ${ECS_CLUSTER} \
                                    --service ${ECS_SERVICE_BACKEND} \
                                    --force-new-deployment \
                                    --region ${AWS_DEFAULT_REGION}
                                
                                # Wait for deployment
                                aws ecs wait services-stable \
                                    --cluster ${ECS_CLUSTER} \
                                    --services ${ECS_SERVICE_BACKEND} \
                                    --region ${AWS_DEFAULT_REGION}
                            """
                        }
                    }
                }
                
                stage('Deploy Frontend') {
                    steps {
                        script {
                            echo "🚀 Deploying Frontend to ECS..."
                            sh """
                                # Update ECS service with new image
                                aws ecs update-service \
                                    --cluster ${ECS_CLUSTER} \
                                    --service ${ECS_SERVICE_FRONTEND} \
                                    --force-new-deployment \
                                    --region ${AWS_DEFAULT_REGION}
                                
                                # Wait for deployment
                                aws ecs wait services-stable \
                                    --cluster ${ECS_CLUSTER} \
                                    --services ${ECS_SERVICE_FRONTEND} \
                                    --region ${AWS_DEFAULT_REGION}
                            """
                        }
                    }
                }
            }
        }
        
        stage('Verify Deployment') {
            when {
                branch 'main'
            }
            steps {
                script {
                    echo "✅ Verifying Deployment..."
                    sh """
                        # Health checks
                        curl -f https://your-api-domain.com/health
                        curl -f https://your-frontend-domain.com/health
                        
                        # Check ECS service status
                        aws ecs describe-services \
                            --cluster ${ECS_CLUSTER} \
                            --services ${ECS_SERVICE_BACKEND} ${ECS_SERVICE_FRONTEND} \
                            --region ${AWS_DEFAULT_REGION}
                    """
                }
            }
        }
    }
    
    post {
        always {
            script {
                // Cleanup test containers if they exist
                sh """
                    docker stop test-backend-${BUILD_NUMBER} || true
                    docker stop test-frontend-${BUILD_NUMBER} || true
                    docker rm test-backend-${BUILD_NUMBER} || true
                    docker rm test-frontend-${BUILD_NUMBER} || true
                    
                    # Cleanup images to save space
                    docker image prune -f
                """
            }
        }
        
        success {
            script {
                echo "✅ Pipeline completed successfully!"
                // Send success notification (Slack, email, etc.)
            }
        }
        
        failure {
            script {
                echo "❌ Pipeline failed!"
                // Send failure notification
            }
        }
    }
}