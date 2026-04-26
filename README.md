# WhatTheFlag 🚩 - Automated Multi-Tier Application Deployment

## Project Overview

This project demonstrates a complete, end-to-end automated deployment pipeline for a microservices-based web application using industry-standard DevOps tools.

**WhatTheFlag** is a real-time flag guessing game built with three Python (Flask) microservices and a MongoDB database. The entire application is containerized, infrastructure-provisioned, configured, orchestrated, and continuously deployed — all through code.

---

## Application Architecture

The application consists of four services working together:

| Service | Technology | Port | Description |
|---|---|---|---|
| **Frontend** | Flask + HTML/CSS/JS | 5000 | Web interface for playing the flag guessing game |
| **Game Engine** | Flask REST API | 5001 | Core game logic, session management, scoring |
| **Bot Service** | Flask REST API | 5002 | AI opponent with configurable difficulty levels |
| **Database** | MongoDB | 27017 | Persistent storage for game state and scores |

---

## Repository Structure

```
WhatTheFlag/
├── frontend/                  # Frontend microservice
│   ├── Dockerfile
│   ├── app.py
│   ├── requirements.txt
│   ├── static/
│   │   ├── app.js
│   │   └── style.css
│   └── templates/
│       └── index.html
├── game-engine/               # Game Engine microservice
│   ├── Dockerfile
│   ├── app.py
│   └── requirements.txt
├── bot-service/               # Bot Service microservice
│   ├── Dockerfile
│   ├── app.py
│   └── requirements.txt
├── terraform/                 # Infrastructure as Code
│   ├── provider.tf            # AWS provider configuration
│   ├── variables.tf           # Centralized variables
│   ├── vpc.tf                 # VPC, Subnet, IGW, Route Table
│   ├── security.tf            # Security Group rules
│   ├── main.tf                # EC2 instance with dynamic AMI lookup
│   └── outputs.tf             # Output values (IP, Instance ID)
├── .github/workflows/
│   └── ci.yml                 # GitHub Actions CI/CD pipeline
├── ansible.cfg                # Ansible configuration
├── setup_app.yml              # Ansible playbook for node configuration
├── inventory.ini              # Ansible inventory (gitignored)
├── k8s-prod.yml               # Kubernetes manifests (all services)
├── k8s-deployment.yml         # Basic K8s deployment manifest
├── argocd-app.yml             # ArgoCD Application definition
├── docker-compose.yml         # Local development orchestration
└── README.md
```

---

## Deployment Methodology & Workflow

The deployment follows a structured, five-phase pipeline. Each phase builds on the previous one, creating a fully automated flow from code change to production deployment.

### Phase 1: Containerization (Docker)

Each microservice has its own `Dockerfile` that packages the application into a portable, reproducible container image.

- **Base Image:** `python:3.9-slim` for minimal footprint.
- **Dependency Installation:** `requirements.txt` is copied and installed separately from the application code to leverage Docker's layer caching.
- **Image Registry:** Images are pushed to Docker Hub under the namespace `aliwhaa` with tags for both `latest` and the specific Git commit SHA (e.g., `aliwhaa/wtf-frontend:e8d98b1`).

### Phase 2: Infrastructure as Code (Terraform)

Terraform provisions the AWS infrastructure declaratively. All resources are defined in the `terraform/` directory.

**Resources Created:**
- **VPC** with DNS hostnames enabled (`10.0.0.0/16`)
- **Public Subnet** with auto-assigned public IPs (`10.0.1.0/24`)
- **Internet Gateway** and **Route Table** for internet access
- **Security Group** allowing SSH (22), App traffic (5000, 30001), MicroK8s API (16443), and ArgoCD UI (8080)
- **EC2 Instance** (`t3.medium`, 20GB root volume) running Ubuntu 22.04 LTS

**Key Design Decisions:**
- The AMI is resolved dynamically using a `data "aws_ami"` block, which queries Canonical's official Ubuntu images. This prevents the common `InvalidAMIID.NotFound` error when switching AWS regions.
- All configurable values (region, key name, instance type) are centralized in `variables.tf` for easy modification.

### Phase 3: Configuration Management (Ansible)

An Ansible playbook (`setup_app.yml`) configures the provisioned EC2 instance from a blank Ubuntu server into a production-ready Kubernetes node.

**Tasks Performed:**
1. Updates the system package cache.
2. Installs Docker for container runtime support.
3. Installs MicroK8s as a lightweight, single-node Kubernetes distribution.
4. Adds the `ubuntu` user to the `docker` and `microk8s` groups.
5. Enables MicroK8s addons: `dns` (for internal service discovery) and `hostpath-storage` (for persistent volumes).
6. Installs ArgoCD into the `argocd` namespace using the official manifests.
7. Copies and applies the `argocd-app.yml` manifest to configure the CD pipeline.

**Architecture Note:** The deployment uses a **Control Node / Target Node** pattern. The Control Node (a separate EC2 instance) runs Terraform and Ansible to provision and configure the Target Node where the application runs.

### Phase 4: Orchestration (Kubernetes)

The `k8s-prod.yml` file defines the complete Kubernetes architecture for all four services:

| Resource | Kind | Details |
|---|---|---|
| `mongo-pvc` | PersistentVolumeClaim | 1Gi storage for MongoDB data persistence |
| `db` | Deployment + Service | MongoDB container with mounted persistent storage |
| `bot-service` | Deployment + Service | Bot AI microservice (ClusterIP, port 5002) |
| `game-engine` | Deployment + Service | Game logic API with environment variables for DB and Bot URLs |
| `frontend` | Deployment + Service (NodePort) | Web UI exposed externally on port **30001** |

Services communicate internally using Kubernetes DNS (e.g., `mongodb://db:27017/`, `http://bot-service:5002`).

### Phase 5: CI/CD Pipeline (GitHub Actions + ArgoCD)

The CI/CD pipeline creates a fully automated loop from code commit to production deployment.

#### Continuous Integration (GitHub Actions)

The workflow (`.github/workflows/ci.yml`) triggers on every push to `main` (excluding changes to `k8s-prod.yml` to prevent infinite loops).

**Pipeline Steps:**
1. Checks out the repository code.
2. Logs into Docker Hub using repository secrets (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`).
3. Builds Docker images for all three microservices.
4. Pushes images tagged with both `latest` and the short Git commit SHA.
5. Updates `k8s-prod.yml` using `sed` to replace old image tags with the new commit SHA.
6. Commits the updated manifest back to the repository with a `[skip ci]` tag to prevent recursive triggers.

#### Continuous Deployment (ArgoCD)

ArgoCD runs inside the MicroK8s cluster and continuously monitors the `k8s-prod.yml` file in this GitHub repository.

**Configuration (`argocd-app.yml`):**
- **Source:** `https://github.com/m-ali-04/WhatTheFlag.git` (branch: `main`)
- **Destination:** The local Kubernetes cluster (`https://kubernetes.default.svc`), `default` namespace.
- **Sync Policy:** Automated with `selfHeal: true` and `prune: true` — ArgoCD will automatically apply any changes it detects and remove resources no longer defined in the manifest.

**The Complete Automation Loop:**
```
Developer pushes code → GitHub Actions builds images → Updates k8s-prod.yml →
ArgoCD detects change → Syncs cluster → New version deployed automatically
```

---

## Deployment Instructions

### Prerequisites
- AWS Account with configured credentials
- An SSH key pair created in your AWS region
- Docker Hub account
- Terraform and Ansible installed on the Control Node

### Step 1: Provision Infrastructure (Terraform)

```bash
cd terraform
terraform init
terraform apply
```

Note the `instance_public_ip` from the output.

### Step 2: Configure the Target Node (Ansible)

1. Update `inventory.ini` with the Target Node's IP address.
2. Run the playbook:
   ```bash
   ansible-playbook -i inventory.ini setup_app.yml
   ```

### Step 3: Configure GitHub Secrets

Add these secrets in your GitHub repository settings (Settings → Secrets → Actions):
- `DOCKERHUB_USERNAME` — Your Docker Hub username
- `DOCKERHUB_TOKEN` — Your Docker Hub access token

Also ensure **Workflow permissions** are set to **Read and write** (Settings → Actions → General).

### Step 4: Trigger the Pipeline

Push any code change to the `main` branch. GitHub Actions will automatically build, push, and update the manifests. ArgoCD will detect the change and deploy it to the cluster.

---

## Accessing the Application

| Service | URL |
|---|---|
| **Game Frontend** | `http://<TARGET_NODE_IP>:30001` |
| **ArgoCD Dashboard** | `https://<TARGET_NODE_IP>:8080` |

**ArgoCD Login:**
- Username: `admin`
- Password: Retrieve with:
  ```bash
  microk8s kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
  ```
