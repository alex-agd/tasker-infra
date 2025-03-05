# Tasker Infrastructure Project

# Task Management Application

- **Project's reporter:** Aliaksei Dalhapolau
- **Group number:** m-sa2-30-24

### Application Details

- **Name:** Task Management Application
- **Programming Language:** Java 17
- **Database:** PostgreSQL 15

## Infrastructure

### ArgoCD

ArgoCD is used in the project for continuous deployment (CD) of applications. ArgoCD configuration is located in the `argocd/` directory.

### Helm

Kubernetes release management is handled using Helm. Helm charts are located in the `helm/tasker/` directory.

## Project Structure

```
tasker-infra/
├── argocd/
│   └── applications/    # ArgoCD application configurations
└── helm/
    └── tasker/         # Helm charts for application deployment
```

## Requirements

- Kubernetes cluster
- Helm v3+
- ArgoCD
- kubectl
