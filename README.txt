================================================================================
        WhatTheFlag - Automated Multi-Tier Application Deployment
================================================================================

PROJECT OVERVIEW
----------------
This project demonstrates a complete, end-to-end automated deployment pipeline
for a microservices-based web application using industry-standard DevOps tools.

WhatTheFlag is a real-time flag guessing game built with three Python (Flask)
microservices and a MongoDB database. The entire application is containerized,
infrastructure-provisioned, configured, orchestrated, and continuously deployed
-- all through code.


APPLICATION ARCHITECTURE
------------------------
Service          Technology          Port    Description
-----------      ---------------     ----    -----------------------------------
Frontend         Flask + HTML/JS     5000    Web UI for the flag guessing game
Game Engine      Flask REST API      5001    Core game logic and scoring
Bot Service      Flask REST API      5002    AI opponent with difficulty levels
Database         MongoDB             27017   Persistent game state and scores


TOOLS & TECHNOLOGIES USED
--------------------------
1. Containerization    : Docker (Dockerfile per microservice)
2. Infrastructure (IaC): Terraform (AWS EC2, VPC, Security Groups)
3. Config Management   : Ansible (Docker, MicroK8s, ArgoCD installation)
4. Orchestration       : Kubernetes via MicroK8s (Deployments, Services, PVCs)
5. CI Pipeline         : GitHub Actions (build, push, update manifests)
6. CD Pipeline         : ArgoCD (auto-sync cluster from GitHub)


DEPLOYMENT METHODOLOGY & WORKFLOW
----------------------------------

Phase 1: Containerization (Docker)
  - Each microservice has its own Dockerfile using python:3.9-slim base image.
  - Dependencies installed via requirements.txt with layer caching.
  - Images pushed to Docker Hub (aliwhaa/wtf-frontend, wtf-engine, wtf-bot).
  - Tagged with both "latest" and the Git commit SHA for traceability.

Phase 2: Infrastructure as Code (Terraform)
  - All AWS resources defined in terraform/ directory.
  - Resources created:
      * VPC (10.0.0.0/16) with DNS hostnames enabled
      * Public Subnet (10.0.1.0/24) with auto-assigned public IPs
      * Internet Gateway and Route Table
      * Security Group (ports 22, 5000, 8080, 16443, 30001)
      * EC2 Instance (t3.medium, 20GB, Ubuntu 22.04 LTS)
  - AMI resolved dynamically using data source (works in any AWS region).
  - All config centralized in variables.tf.

Phase 3: Configuration Management (Ansible)
  - Playbook: setup_app.yml
  - Uses Control Node / Target Node architecture.
  - Tasks performed on Target Node:
      1. Updates system package cache
      2. Installs Docker
      3. Installs MicroK8s (lightweight Kubernetes)
      4. Adds ubuntu user to docker and microk8s groups
      5. Enables MicroK8s addons (dns, hostpath-storage)
      6. Installs ArgoCD into the argocd namespace
      7. Applies ArgoCD Application manifest

Phase 4: Orchestration (Kubernetes)
  - All manifests defined in k8s-prod.yml.
  - Resources:
      * PersistentVolumeClaim (1Gi for MongoDB)
      * MongoDB Deployment + ClusterIP Service
      * Bot Service Deployment + ClusterIP Service
      * Game Engine Deployment + ClusterIP Service
      * Frontend Deployment + NodePort Service (exposed on port 30001)
  - Internal communication via Kubernetes DNS.

Phase 5: CI/CD Pipeline (GitHub Actions + ArgoCD)

  Continuous Integration (GitHub Actions):
    - Triggers on push to main branch.
    - Logs into Docker Hub using repository secrets.
    - Builds and pushes images for all three microservices.
    - Updates k8s-prod.yml with new commit SHA tags using sed.
    - Commits updated manifest back to repo with [skip ci] tag.

  Continuous Deployment (ArgoCD):
    - Monitors k8s-prod.yml in the GitHub repository.
    - Automated sync with selfHeal and prune enabled.
    - Detects manifest changes and rolls out new versions automatically.

  The Complete Automation Loop:
    Developer pushes code
      -> GitHub Actions builds images
        -> Updates k8s-prod.yml
          -> ArgoCD detects change
            -> Syncs cluster
              -> New version deployed automatically


DEPLOYMENT INSTRUCTIONS
-----------------------

Prerequisites:
  - AWS Account with configured credentials
  - SSH key pair created in your AWS region
  - Docker Hub account
  - Terraform and Ansible installed on the Control Node

Step 1: Provision Infrastructure
  $ cd terraform
  $ terraform init
  $ terraform apply
  (Note the instance_public_ip from the output)

Step 2: Configure the Target Node
  1. Update inventory.ini with the Target Node IP.
  2. Run the playbook:
     $ ansible-playbook -i inventory.ini setup_app.yml

Step 3: Configure GitHub Secrets
  Add these in GitHub repo Settings -> Secrets -> Actions:
    - DOCKERHUB_USERNAME
    - DOCKERHUB_TOKEN
  Set Workflow permissions to "Read and write" in Settings -> Actions -> General.

Step 4: Trigger the Pipeline
  Push any code change to main. GitHub Actions builds, pushes, and updates
  manifests. ArgoCD detects the change and deploys automatically.


ACCESSING THE APPLICATION
--------------------------
Game Frontend    : http://<TARGET_NODE_IP>:30001
ArgoCD Dashboard : https://<TARGET_NODE_IP>:8080

ArgoCD Login:
  Username: admin
  Password: Run this on the Target Node:
    $ microk8s kubectl -n argocd get secret argocd-initial-admin-secret \
        -o jsonpath="{.data.password}" | base64 -d; echo


REPOSITORY STRUCTURE
--------------------
WhatTheFlag/
  frontend/                    Frontend microservice
    Dockerfile
    app.py
    requirements.txt
    static/app.js, style.css
    templates/index.html
  game-engine/                 Game Engine microservice
    Dockerfile, app.py, requirements.txt
  bot-service/                 Bot Service microservice
    Dockerfile, app.py, requirements.txt
  terraform/                   Infrastructure as Code
    provider.tf, variables.tf, vpc.tf, security.tf, main.tf, outputs.tf
  .github/workflows/ci.yml    GitHub Actions CI/CD pipeline
  ansible.cfg                  Ansible configuration
  setup_app.yml                Ansible playbook
  inventory.ini                Ansible inventory (gitignored)
  k8s-prod.yml                 Kubernetes manifests
  argocd-app.yml               ArgoCD Application definition
  docker-compose.yml           Local development orchestration
  README.md                    Project documentation

================================================================================
