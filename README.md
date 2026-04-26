# WhatTheFlag 🚩 - Automated Deployment Pipeline

This repository demonstrates a complete, automated Multi-Tier Application Deployment pipeline using modern DevOps practices. 

The application is a microservices-based flag guessing game built with Python (Flask) and MongoDB.

## Architecture & Tools Used

1. **Containerization:** Docker (`Dockerfile`s for each microservice).
2. **Infrastructure as Code (IaC):** Terraform (Provisions an AWS EC2 instance, VPC, and Security Groups).
3. **Configuration Management:** Ansible (Installs Docker, MicroK8s, and ArgoCD on the target node).
4. **Orchestration:** Kubernetes (Deployments and Services for Frontend, Game Engine, Bot Service, and Database).
5. **Continuous Integration (CI):** GitHub Actions (Builds and pushes Docker images, updates K8s manifests).
6. **Continuous Deployment (CD):** ArgoCD (Monitors GitHub and synchronizes the cluster automatically).

---

## Deployment Instructions

Follow these steps to deploy the application from scratch.

### Step 1: Provision Infrastructure (Terraform)
This step creates the EC2 instance and networking rules.

1. Ensure you have AWS credentials configured locally.
2. Navigate to the `terraform/` directory:
   ```bash
   cd terraform
   ```
3. Initialize and apply the configuration:
   ```bash
   terraform init
   terraform apply -auto-approve
   ```
4. Note the output `instance_public_ip`.

### Step 2: Configure the Node (Ansible)
This step installs dependencies and sets up the Kubernetes cluster.

1. Add your new EC2 IP address to the `inventory.ini` file under `[target]`.
2. Run the Ansible playbook:
   ```bash
   ansible-playbook -i inventory.ini setup_app.yml
   ```
   *Note: This playbook automatically enables necessary MicroK8s addons and installs ArgoCD.*

### Step 3: CI/CD Automation (GitHub Actions & ArgoCD)

The pipeline is now fully automated! 

1. **GitHub Actions (CI):** Whenever code is pushed to the `main` branch, the `.github/workflows/ci.yml` workflow triggers. It builds new Docker images, pushes them to Docker Hub, and automatically updates `k8s-prod.yml` with the new image tags.
2. **ArgoCD (CD):** ArgoCD, running on your EC2 instance, continuously monitors this repository. When GitHub Actions updates `k8s-prod.yml`, ArgoCD detects the change and automatically rolls out the new version to your Kubernetes cluster without manual intervention.

---

## Accessing the Application

Once the pipeline has completed and ArgoCD has synced the cluster, the game frontend is exposed via a Kubernetes NodePort.

Open your browser and navigate to:
```
http://<EC2_PUBLIC_IP>:30001
```
